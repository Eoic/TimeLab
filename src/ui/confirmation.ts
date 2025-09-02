import { openModal, closeModal } from './dom.js';

export interface ConfirmationOptions {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    icon?: 'warning' | 'error' | 'info' | 'question';
    danger?: boolean;
}

/**
 * Show a custom confirmation dialog instead of browser confirm()
 * Returns a Promise that resolves to true if confirmed, false if cancelled
 */
export function showConfirmation(options: ConfirmationOptions): Promise<boolean> {
    return new Promise((resolve) => {
        // Remember the element that had focus before opening the confirmation
        const previouslyFocusedElement = document.activeElement as HTMLElement | null;

        const modal = document.getElementById('modal-confirm');
        const titleElement = document.getElementById('confirm-title');
        const messageElement = document.getElementById('confirm-message');
        const iconElement = document.getElementById('confirm-icon');
        const okButton = document.getElementById('confirm-ok');
        const okTextElement = document.getElementById('confirm-ok-text');
        const cancelButton = document.getElementById('confirm-cancel');

        if (
            !modal ||
            !titleElement ||
            !messageElement ||
            !iconElement ||
            !okButton ||
            !okTextElement ||
            !cancelButton
        ) {
            // Modal elements not found, fall back to browser confirm
            resolve(false);
            return;
        }

        // Set content
        titleElement.textContent = options.title || 'Confirm action';
        messageElement.textContent = options.message;
        okTextElement.textContent = options.confirmText || 'Confirm';

        // Set icon
        const iconName = options.icon || 'warning';
        iconElement.textContent = iconName;

        // Style the confirm button based on danger level
        okButton.className = options.danger ? 'btn-primary btn-danger' : 'btn-primary';

        // Event handlers
        const handleConfirm = () => {
            cleanup();
            // For confirmation modals, manually manage focus before closing
            if (previouslyFocusedElement) {
                previouslyFocusedElement.focus();
                // Use requestAnimationFrame to ensure focus moves before closing
                requestAnimationFrame(() => {
                    closeModal(modal);
                    resolve(true);
                });
            } else {
                closeModal(modal);
                resolve(true);
            }
        };

        const handleCancel = () => {
            cleanup();
            // For confirmation modals, manually manage focus before closing
            if (previouslyFocusedElement) {
                previouslyFocusedElement.focus();
                // Use requestAnimationFrame to ensure focus moves before closing
                requestAnimationFrame(() => {
                    closeModal(modal);
                    resolve(false);
                });
            } else {
                closeModal(modal);
                resolve(false);
            }
        };

        const handleKeydown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleCancel();
            } else if (e.key === 'Enter') {
                // Check which element has focus to determine the action
                const focusedElement = document.activeElement;
                if (focusedElement === cancelButton) {
                    handleCancel();
                } else if (focusedElement === okButton) {
                    handleConfirm();
                } else {
                    // If focus is elsewhere in the modal, default to cancel for safety
                    handleCancel();
                }
            }
        };

        const cleanup = () => {
            okButton.removeEventListener('click', handleConfirm);
            cancelButton.removeEventListener('click', handleCancel);
            modal.removeEventListener('keydown', handleKeydown);
        };

        // Attach event listeners
        okButton.addEventListener('click', handleConfirm);
        cancelButton.addEventListener('click', handleCancel);
        modal.addEventListener('keydown', handleKeydown);

        // Handle backdrop clicks and other close triggers
        const handleModalClick = (e: Event) => {
            const target = e.target as HTMLElement;
            if (target.closest('[data-close]') || target === modal) {
                handleCancel();
            }
        };

        modal.addEventListener('click', handleModalClick, { once: true });

        // Show the modal
        openModal(modal);

        // Focus the cancel button by default for safety
        setTimeout(() => {
            cancelButton.focus();
        }, 100);
    });
}

/**
 * Convenience function for delete confirmations
 */
export function confirmDelete(itemName: string, itemType = 'item'): Promise<boolean> {
    return showConfirmation({
        title: `Delete ${itemType}`,
        message: `Are you sure you want to delete "${itemName}"?\n\nThis action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        icon: 'warning',
        danger: true,
    });
}

/**
 * Convenience function for destructive action confirmations
 */
export function confirmAction(action: string, description: string): Promise<boolean> {
    return showConfirmation({
        title: `Confirm ${action}`,
        message: description,
        confirmText: action,
        cancelText: 'Cancel',
        icon: 'warning',
        danger: true,
    });
}
