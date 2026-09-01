import React from 'react';
import Modal from './Modal';

interface ConfirmModalProps {
    isLoading?: boolean;
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isLoading = false,
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDestructive = false
}) => {
    return (
        <Modal isOpen={isOpen} onClose={onCancel} title={title} role="alertdialog">
            <div className="text-gray-300 mb-6">
                {message}
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-3">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isLoading}
                    className="px-4 py-3 bg-surface hover:bg-surface text-white rounded-lg touch-target font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {cancelText}
                </button>
                <button
                    type="button"
                    onClick={() => {
                        onConfirm();
                        onCancel();
                    }}
                    disabled={isLoading}
                    className={`px-4 py-3 text-white rounded-lg touch-target font-bold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                        isDestructive ? 'bg-red-600 hover:bg-red-500' : 'bg-brand-600 hover:bg-brand-500'
                    }`}
                >
                    {isLoading ? (
                        <>
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                            <span aria-live="polite">Processing...</span>
                        </>
                    ) : confirmText}
                </button>
            </div>
        </Modal>
    );
};

export default ConfirmModal;
