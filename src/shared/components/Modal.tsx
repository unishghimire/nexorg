import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useLocation } from 'react-router-dom';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    maxWidth?: string;
    role?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth = "sm:max-w-lg", role = "dialog" }) => {
    const dialogRef = useRef<HTMLDivElement>(null);
    const previouslyFocused = useRef<HTMLElement | null>(null);
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    // Handle open/close lifecycle (Escape, body scroll lock, initial focus & restore)
    useEffect(() => {
        if (!isOpen) return;

        // Store currently focused element before modal opened to restore on close
        previouslyFocused.current = document.activeElement as HTMLElement;
        document.body.style.overflow = 'hidden';

        // Initial focus only once on open, if focus is not already inside dialog
        const timeoutId = setTimeout(() => {
            if (dialogRef.current && !dialogRef.current.contains(document.activeElement)) {
                const focusable = dialogRef.current.querySelector<HTMLElement>(
                    '[data-modal-close], button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                );
                focusable?.focus();
            }
        }, 50);

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onCloseRef.current?.();
                return;
            }

            // Focus trap: keep Tab within the dialog
            if (e.key === 'Tab' && dialogRef.current) {
                const nodes = dialogRef.current.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                );
                if (!nodes || nodes.length === 0) return;
                const first = nodes[0];
                const last = nodes[nodes.length - 1];

                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
            // Restore focus to the element that opened the modal
            if (previouslyFocused.current && typeof previouslyFocused.current.focus === 'function') {
                previouslyFocused.current.focus();
            }
        };
    }, [isOpen]);

    const location = useLocation();
    const prevPath = useRef(location.pathname);
    useEffect(() => {
        if (isOpen && prevPath.current !== location.pathname) {
            onCloseRef.current?.();
            prevPath.current = location.pathname;
        }
    }, [location.pathname, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] overflow-y-auto" role={role} aria-modal="true" aria-labelledby={title ? "modal-title" : undefined}>
            <div className="flex min-h-[100dvh] items-center justify-center p-0 sm:p-4 sm:pt-8 sm:pb-20">
                <div className="fixed inset-0 modal-backdrop transition-opacity" onClick={onClose} aria-hidden="true"></div>
                <div ref={dialogRef} className={`relative w-full ${maxWidth} max-w-[calc(100vw-0px)] sm:max-w-[calc(100vw-2rem)] bg-card rounded-t-2xl sm:rounded-xl text-left overflow-hidden shadow-2xl transform transition-colors sm:my-8 border border-gray-700 max-h-[100dvh] sm:max-h-[90vh] flex flex-col`}>
                    {(title || true) && (
                        <div className="bg-surface px-4 sm:px-6 py-4 border-b border-gray-700 flex justify-between items-center shrink-0">
                            {title && <h3 id="modal-title" className="text-base sm:text-lg font-bold text-white break-anywhere">{title}</h3>}
                            <button data-modal-close onClick={onClose} className="text-gray-400 hover:text-white transition shrink-0 touch-target flex items-center justify-center ml-auto" aria-label="Close" type="button">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                    <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Modal;
