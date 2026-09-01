import { sanitizeUrl } from '../../../../shared/utils/utils';
import React from 'react';
import {Search, Trash, Image as ImageIcon, ExternalLink, RefreshCw} from 'lucide-react';
import {MediaCategory} from '../../../../shared/services/mediaService';

import { AdminPanelTabProps } from './types';

export const MediaTab: React.FC<AdminPanelTabProps> = (props) => {
    const { ImageUploader,  MediaCategory, fetchMedia, getRelativeTime, handleDeleteMedia, mediaFilter, mediaItems, mediaLoading, mediaSearch, directUploadUrl, selectedMediaCategory, setMediaFilter, setMediaSearch, setDirectUploadUrl, setSelectedMediaCategory, showToast } = props;
    return (
                <div className="bg-card p-6 rounded-xl border border-gray-800 space-y-8 animate-fade-in">
                    <div className="border-b border-gray-700 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
                                <ImageIcon className="text-brand-500" /> Media Library Assets
                            </h2>
                            <p className="text-xs text-gray-500 mt-1 uppercase font-bold">Securely browse and manage image assets uploaded through ImgBB proxy.</p>
                        </div>
                        <button type="button"
                            onClick={fetchMedia}
                            disabled={mediaLoading}
                            className="bg-surface hover:bg-surface/80 text-white px-5 py-2 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition"
                        >
                            <RefreshCw className={`w-4 h-4 ${mediaLoading ? 'animate-spin' : ''}`} />
                            Refresh Library
                        </button>
                    </div>

                    {/* Uploder catalog registration box */}
                    <div className="bg-dark/40 p-5 rounded-xl border border-gray-800/80 space-y-4">
                        <h3 className="text-sm font-bold text-brand-400 uppercase tracking-widest pl-3 border-l-2 border-brand-500">Quick Upload to Library</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                            <div className="space-y-2">
                                <label htmlFor="asset-category" className="text-[10px] text-gray-500 uppercase font-black tracking-wider">Asset Category Group</label>
                                <select
                                    value={selectedMediaCategory}
                                    onChange={(e) => setSelectedMediaCategory(e.target.value as MediaCategory)}
                                    className="w-full bg-surface border border-gray-700 rounded-lg p-3 text-white text-xs font-bold uppercase tracking-wider focus:border-brand-500 focus-visible:outline-none"
                                >
                                    {Object.values(MediaCategory).map((cat: string) => (
                                        <option key={cat} value={cat}>
                                            {cat.replace("_", " ")}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <ImageUploader
                                    category={selectedMediaCategory}
                                    value={directUploadUrl}
                                    onChange={(url) => {
                                        setDirectUploadUrl(url);
                                        if (url) {
                                            showToast("Asset successfully uploaded and registered in library!", "success");
                                            fetchMedia();
                                            setDirectUploadUrl(""); // reset uploader slot
                                        }
                                    }}
                                    aspectRatio="video"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Filter and Search controls */}
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between pb-2 border-b border-gray-800">
                        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                            <button type="button"
                                onClick={() => setMediaFilter("ALL")}
                                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                                    mediaFilter === "ALL"
                                        ? "bg-brand-500 text-white"
                                        : "bg-surface/80 text-gray-400 hover:bg-surface hover:text-white"
                                }`}
                            >
                                All Assets
                            </button>
                            {Object.values(MediaCategory).map((cat: string) => {
                                // check if we have items of this type
                                const count = mediaItems.filter(item => item.category === cat).length;
                                if (count === 0 && cat !== MediaCategory.OTHER) return null;
                                return (
                                    <button type="button"
                                        key={cat}
                                        onClick={() => setMediaFilter(cat)}
                                        className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                                            mediaFilter === cat
                                                ? "bg-brand-500 text-white"
                                                : "bg-surface/85 text-gray-400 hover:bg-surface hover:text-white"
                                        }`}
                                    >
                                        {cat.replace("_", " ")} <span className="opacity-60">({count})</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Search keyword input */}
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                            <input
                                type="text"
                                value={mediaSearch}
                                onChange={(e) => setMediaSearch(e.target.value)}
                                placeholder="Search by asset name..."
                                className="w-full bg-dark/70 border border-gray-700/80 rounded-lg py-2.5 pl-10 pr-4 text-xs text-white focus:border-brand-500 focus-visible:outline-none"
                            />
                        </div>
                    </div>

                    {/* Assets Grid */}
                    {mediaLoading ? (
                        <div className="flex flex-col items-center justify-center p-12 space-y-3">
                            <RefreshCw className="w-8 h-8 text-brand-500 animate-spin" />
                            <p className="text-xs text-gray-500 uppercase font-bold tracking-widest animate-pulse">Scanning Media Catalog...</p>
                        </div>
                    ) : (
                        (() => {
                            const filtered = mediaItems.filter((item) => {
                                const matchesFilter = mediaFilter === "ALL" || item.category === mediaFilter;
                                const matchesSearch =
                                    !mediaSearch ||
                                    (item.fileName && item.fileName.toLowerCase().includes(mediaSearch.toLowerCase())) ||
                                    (item.url && item.url.toLowerCase().includes(mediaSearch.toLowerCase()));
                                return matchesFilter && matchesSearch;
                            });

                            if (filtered.length === 0) {
                                return (
                                    <div className="bg-dark/10 border border-dashed border-gray-800 rounded-xl p-12 text-center text-gray-500">
                                        <ImageIcon className="w-12 h-12 mx-auto text-gray-700 mb-3" />
                                        <p className="text-sm font-bold uppercase tracking-wider text-gray-400">No media assets found</p>
                                        <p className="text-xs uppercase text-gray-600 mt-1 font-semibold">Try changing your filter settings or upload a new asset above.</p>
                                    </div>
                                );
                            }

                            return (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                    {filtered.map((item) => (
                                        <div key={item.id} className="group bg-dark/60 rounded-xl border border-gray-800 overflow-hidden hover:border-gray-700 transition duration-150 flex flex-col pt-0 pb-0">
                                            <div className="relative aspect-video bg-slate-950 overflow-hidden border-b border-gray-850">
                                                <img
                                                    src={item.url}
                                                    alt={item.fileName || "Media Asset"}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                                    referrerPolicy="no-referrer" loading="lazy" />
                                                <div className="absolute top-2 left-2 bg-black/75 px-2.5 py-1 rounded text-[10px] font-bold text-brand-400 uppercase tracking-wider border border-brand-500/10">
                                                    {item.category ? item.category.replace("_", " ") : "OTHER"}
                                                </div>
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                    <a
                                                        href={sanitizeUrl(item.url)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 rounded-lg bg-dark text-white hover:bg-amber-500 hover:text-black transition shadow"
                                                        title="Open direct image link"
                                                    >
                                                        <ExternalLink className="w-4 h-4" />
                                                    </a>
                                                    <button type="button"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(item.url);
                                                            showToast("Direct link copied to clipboard!", "success");
                                                        }}
                                                        className="p-2 rounded-lg bg-dark text-white hover:bg-brand-500 hover:text-white transition shadow text-xs font-bold uppercase"
                                                        title="Copy URL link"
                                                    >
                                                        Copy URL
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="p-3 flex-1 flex flex-col justify-between">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-gray-200 truncate" title={item.fileName}>
                                                        {item.fileName || "unnamed_asset"}
                                                    </p>
                                                    <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">
                                                        {(item.fileSize / 1024).toFixed(1)} KB • {item.mimeType?.replace("image/", "") || "IMG"}
                                                    </p>
                                                </div>
                                                <div className="mt-3 pt-2.5 border-t border-gray-850 flex items-center justify-between text-[10px]">
                                                    <span className="text-gray-600 font-bold uppercase">{getRelativeTime(item.createdAt)}</span>
                                                    <button type="button"
                                                        onClick={() => handleDeleteMedia(item.id, item.url, item.publicId || item.public_id)}
                                                        className="text-rose-500 hover:text-rose-400 flex items-center gap-1 font-bold uppercase"
                                                        title="Delete reference"
                                                    >
                                                        <Trash className="w-3 h-3" />
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()
                    )}
                </div>
    );
};
