// FILE_ID: services/mediaService.ts
// MODULE: Centralized Media Management
// PURPOSE: ImgBB universal image upload, validation, replacement, and deletion across the entire web app
// DEPENDENCIES: firebase.ts

import { getAuth } from "firebase/auth";
import { doc, collection, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase";

export enum MediaCategory {
  USER_AVATAR = "USER_AVATAR",
  TEAM_LOGO = "TEAM_LOGO",
  TEAM_BANNER = "TEAM_BANNER",
  ORG_LOGO = "ORG_LOGO",
  ORG_BANNER = "ORG_BANNER",
  TOURNAMENT_BANNER = "TOURNAMENT_BANNER",
  TOURNAMENT_THUMBNAIL = "TOURNAMENT_THUMBNAIL",
  SCRIM_BANNER = "SCRIM_BANNER",
  PRODUCT_IMAGE = "PRODUCT_IMAGE",
  NEWS_IMAGE = "NEWS_IMAGE",
  SPONSOR_LOGO = "SPONSOR_LOGO",
  PAYMENT_PROOF = "PAYMENT_PROOF",
  OVERLAY_GRAPHIC = "OVERLAY_GRAPHIC",
  OTHER = "OTHER"
}

export interface MediaRecord {
  id: string;
  userId: string;
  url: string;
  publicId: string;
  thumbUrl?: string;
  mediumUrl?: string;
  provider?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: MediaCategory;
  createdAt: any;
}

export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// Per-category size limits (bytes)
const CATEGORY_SIZE_LIMITS: Partial<Record<MediaCategory, number>> = {
  [MediaCategory.USER_AVATAR]: 5 * 1024 * 1024,       // 5MB
  [MediaCategory.TEAM_LOGO]: 5 * 1024 * 1024,          // 5MB
  [MediaCategory.TEAM_BANNER]: 10 * 1024 * 1024,       // 10MB
  [MediaCategory.ORG_LOGO]: 5 * 1024 * 1024,           // 5MB
  [MediaCategory.ORG_BANNER]: 10 * 1024 * 1024,       // 10MB
  [MediaCategory.TOURNAMENT_BANNER]: 10 * 1024 * 1024, // 10MB
  [MediaCategory.TOURNAMENT_THUMBNAIL]: 5 * 1024 * 1024, // 5MB
  [MediaCategory.SCRIM_BANNER]: 10 * 1024 * 1024,      // 10MB
  [MediaCategory.NEWS_IMAGE]: 10 * 1024 * 1024,       // 10MB
  [MediaCategory.PRODUCT_IMAGE]: 5 * 1024 * 1024,     // 5MB
  [MediaCategory.SPONSOR_LOGO]: 5 * 1024 * 1024,      // 5MB
  [MediaCategory.PAYMENT_PROOF]: 10 * 1024 * 1024,    // 10MB
  [MediaCategory.OVERLAY_GRAPHIC]: 10 * 1024 * 1024,  // 10MB
  [MediaCategory.OTHER]: 10 * 1024 * 1024,            // 10MB
};

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB global default

const IMGBB_CLIENT_KEY = (import.meta as any).env?.VITE_IMGBB_API_KEY || "";

/**
 * Validates file type, extension, and size based on category
 */
export function validateImage(file: File, category?: MediaCategory): { isValid: boolean; error?: string } {
  if (!file) return { isValid: false, error: "No file selected." };

  const fileName = file.name?.toLowerCase() || "";
  const isImageMime = file.type.startsWith("image/") || ALLOWED_MIME_TYPES.includes(file.type);
  const hasImageExt = /\.(jpg|jpeg|png|webp|gif|heic|heif|jfif|bmp)$/i.test(fileName);

  if (!isImageMime && !hasImageExt && file.type !== "") {
    return {
      isValid: false,
      error: `Invalid file format (${file.type || fileName}). Please select an image file.`,
    };
  }

  const maxSize = (category && CATEGORY_SIZE_LIMITS[category]) || MAX_FILE_SIZE_BYTES;
  if (file.size > maxSize) {
    const maxMB = (maxSize / (1024 * 1024)).toFixed(0);
    const fileMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      isValid: false,
      error: `File is too large (${fileMB}MB). Maximum for this image type is ${maxMB}MB.`,
    };
  }

  return { isValid: true };
}

/**
 * Direct client-side upload to ImgBB (used when server proxy is unavailable or cold-starting)
 */
async function uploadDirectToImgBB(file: File): Promise<{ url: string; thumbUrl: string; mediumUrl: string; deleteUrl: string }> {
  if (!IMGBB_CLIENT_KEY) {
    throw new Error("Client direct upload unavailable (VITE_IMGBB_API_KEY is not configured).");
  }

  const formData = new FormData();
  formData.append("image", file);
  formData.append("name", file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "_") || `img_${Date.now()}`);

  const resp = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(IMGBB_CLIENT_KEY)}`, {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => resp.statusText);
    throw new Error(`ImgBB upload failed (${resp.status}): ${errText}`);
  }

  const json = await resp.json();
  if (!json?.success || !json?.data?.url) {
    throw new Error(json?.error?.message || "ImgBB returned unexpected response");
  }

  const d = json.data;
  return {
    url: d.url,
    thumbUrl: d.thumb?.url || d.url,
    mediumUrl: d.medium?.url || d.thumb?.url || d.url,
    deleteUrl: d.delete_url || "",
  };
}

/**
 * Universal upload function: uploads to ImgBB via server proxy with direct ImgBB fallback
 */
export async function uploadImage(
  file: File,
  category: MediaCategory,
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; url: string; publicId: string; thumbUrl?: string; mediumUrl?: string; mediaData?: Partial<MediaRecord>; error?: string }> {
  try {
    const check = validateImage(file, category);
    if (!check.isValid) {
      return { success: false, url: "", publicId: "", error: check.error };
    }

    const auth = getAuth();
    const token = await auth.currentUser?.getIdToken();

    if (onProgress) onProgress(20);

    // 1. Primary: Try Server Upload Route to ImgBB
    if (token) {
      try {
        const formData = new FormData();
        formData.append("image", file);
        formData.append("category", category);

        const response = await fetch("/api/upload/image", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (response.ok) {
          const result = await response.json().catch(() => null);
          if (result && result.success && result.url) {
            if (onProgress) onProgress(100);
            const mediaId = result.media?.id || doc(collection(db, "media")).id;
            const mediaRecord: MediaRecord = {
              id: mediaId,
              userId: auth.currentUser?.uid || "guest",
              url: result.url,
              publicId: result.public_id || "",
              thumbUrl: result.media?.thumbUrl || result.url,
              mediumUrl: result.media?.mediumUrl || result.url,
              provider: "imgbb",
              fileName: file.name,
              fileSize: file.size,
              mimeType: file.type,
              category,
              createdAt: new Date().toISOString(),
            };
            return {
              success: true,
              url: result.url,
              publicId: result.public_id || "",
              thumbUrl: mediaRecord.thumbUrl,
              mediumUrl: mediaRecord.mediumUrl,
              mediaData: mediaRecord,
            };
          }
        }
      } catch (serverErr) {
        console.warn("[Media Service] Server route failed, falling back to direct ImgBB:", serverErr);
      }
    }

    if (onProgress) onProgress(50);

    // 2. Direct ImgBB API Fallback
    const directResult = await uploadDirectToImgBB(file);
    if (onProgress) onProgress(100);

    const mediaId = doc(collection(db, "media")).id;
    const mediaRecord: MediaRecord = {
      id: mediaId,
      userId: auth.currentUser?.uid || "guest",
      url: directResult.url,
      publicId: directResult.deleteUrl,
      thumbUrl: directResult.thumbUrl,
      mediumUrl: directResult.mediumUrl,
      provider: "imgbb",
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      category,
      createdAt: new Date().toISOString(),
    };

    // Save record in Firestore media catalog
    try {
      await setDoc(doc(db, "media", mediaId), {
        ...mediaRecord,
        createdAt: serverTimestamp(),
      });
    } catch (fsErr) {
      console.warn("[Media Service] Firestore catalog save skipped:", fsErr);
    }

    return {
      success: true,
      url: directResult.url,
      publicId: directResult.deleteUrl,
      thumbUrl: directResult.thumbUrl,
      mediumUrl: directResult.mediumUrl,
      mediaData: mediaRecord,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "An unexpected error occurred during image upload.";
    console.error("[Media Service] Upload failed:", msg);
    return { success: false, url: "", publicId: "", error: msg };
  }
}

/**
 * Removes an asset from ImgBB and deletes the Firestore catalog entry.
 */
export async function deleteImage(mediaId: string, _publicId: string): Promise<boolean> {
  try {
    const auth = getAuth();
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      console.error("[Media Service] Unauthorized deletion attempt");
      return false;
    }

    const response = await fetch("/api/media/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ mediaId }),
    });

    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) {
      console.warn("[Media Service] Server-side delete failed:", result?.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Media Service] Failed to complete media deletion:", err);
    return false;
  }
}

/**
 * Replace an old image with a new one.
 */
export async function replaceImage(
  oldMediaId: string,
  oldPublicId: string,
  newFile: File,
  category: MediaCategory,
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; url: string; publicId: string; thumbUrl?: string; mediumUrl?: string; mediaData?: Partial<MediaRecord>; error?: string }> {
  const uploadResult = await uploadImage(newFile, category, onProgress);
  if (!uploadResult.success) {
    return uploadResult;
  }

  if (oldPublicId || oldMediaId) {
    deleteImage(oldMediaId, oldPublicId).catch(err => {
      console.warn("[Media Service] Async old image cleanup failed:", err);
    });
  }

  return uploadResult;
}

/**
 * Returns the best URL for a given display size.
 */
export function getDisplayUrl(
  url: string,
  size: "thumb" | "medium" | "full" = "full",
  thumbUrl?: string,
  mediumUrl?: string
): string {
  if (!url) return "";
  if (size === "thumb" && thumbUrl) return thumbUrl;
  if (size === "medium" && mediumUrl) return mediumUrl;
  return url;
}

/**
 * Legacy URL formatter
 */
export function generateOptimizedUrl(url: string): string {
  return url || "";
}

/**
 * Returns raw image URL. Accepts full URLs.
 */
export function getImageUrl(urlOrPublicId: string): string {
  if (!urlOrPublicId) return "";
  if (urlOrPublicId.startsWith("http://") || urlOrPublicId.startsWith("https://") || urlOrPublicId.startsWith("data:")) return urlOrPublicId;
  return "";
}
