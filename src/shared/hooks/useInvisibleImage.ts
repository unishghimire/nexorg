import React, { useCallback, useState } from 'react';
import imageCompression from 'browser-image-compression';
import { useNotification } from '../context/NotificationContext';
import { uploadImage, MediaCategory, validateImage } from '../services/mediaService';

interface UseInvisibleImageOptions {
    onUploadSuccess: (url: string) => void;
    onUploadStart?: () => void;
    onUploadEnd?: () => void;
    onError?: (error: string) => void;
    folder?: string;
    category?: MediaCategory;
}

/**
 * useInvisibleImage — paste/drop/file-select hook for image uploads.
 * All uploads go through mediaService.uploadImage() → server → ImgBB.
 * ponytail: unified through mediaService so there's one upload path, not two.
 */
export const useInvisibleImage = (options: UseInvisibleImageOptions) => {
    const { onUploadSuccess, onUploadStart, onUploadEnd, onError, folder = 'gallery', category = MediaCategory.OTHER } = options;
    const { showToast } = useNotification();
    const [isProcessing, setIsProcessing] = useState(false);

    const processAndUpload = useCallback(async (file: File) => {
        // 1. Client validation
        const validation = validateImage(file, category);
        if (!validation.isValid) {
            showToast(validation.error || 'Invalid image', 'error');
            onError?.(validation.error || 'Invalid image');
            return;
        }

        onUploadStart?.();
        setIsProcessing(true);

        try {
            // 2. Compress image before upload (reduces bandwidth + ImgBB payload)
            const compressionOptions = {
                maxSizeMB: 1,
                maxWidthOrHeight: 1920,
                useWebWorker: true,
            };
            const compressedFile = await imageCompression(file, compressionOptions);

            // 3. Upload via mediaService → server → ImgBB
            const result = await uploadImage(compressedFile, category);

            if (result.success && result.url) {
                onUploadSuccess(result.url);
                showToast('Image uploaded successfully!', 'success');
            } else {
                const err = result.error || 'Failed to upload image';
                showToast(err, 'error');
                onError?.(err);
            }
        } catch (error) {
            console.error('Image processing error:', error);
            const msg = error instanceof Error ? error.message : 'Error processing image';
            showToast(msg, 'error');
            onError?.(msg);
        } finally {
            onUploadEnd?.();
            setIsProcessing(false);
        }
    }, [onUploadSuccess, onUploadStart, onUploadEnd, onError, category, showToast]);

    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) processAndUpload(file);
            }
        }
    }, [processAndUpload]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                processAndUpload(file);
            }
        }
    }, [processAndUpload]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
    }, []);

    return {
        handlePaste,
        handleDrop,
        handleDragOver,
        processAndUpload,
        isProcessing
    };
};
