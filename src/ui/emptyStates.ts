/**
 * Utility functions for managing empty states across different panels
 */

export interface EmptyStateConfig {
    icon: string;
    title: string;
    subtitle?: string;
    className?: string;
}

/**
 * Create an empty state element
 */
export function createEmptyState(config: EmptyStateConfig): HTMLLIElement {
    const li = document.createElement('li');
    li.className = `empty-state ${config.className || ''}`;
    li.setAttribute('role', 'listitem');
    li.setAttribute('aria-label', config.title);

    li.innerHTML = `
        <div class="empty-state-content">
            <span class="material-symbols-outlined empty-icon">${config.icon}</span>
            <div class="empty-title">${config.title}</div>
            ${config.subtitle ? `<div class="empty-subtitle text-muted text-sm">${config.subtitle}</div>` : ''}
        </div>
    `;

    return li;
}

/**
 * Manage empty state for a list container
 */
export function updateEmptyState(
    container: HTMLElement,
    itemSelector: string,
    emptyStateConfig: EmptyStateConfig
): void {
    const items = container.querySelectorAll(itemSelector);
    const existingEmpty = container.querySelector('.empty-state');

    if (items.length === 0) {
        // Show empty state if no items exist
        if (!existingEmpty) {
            const emptyState = createEmptyState(emptyStateConfig);
            container.appendChild(emptyState);
        }
    } else {
        // Remove empty state if items exist
        existingEmpty?.remove();
    }
}

/**
 * Setup empty state management for history panel
 */
export function setupLabelsEmptyStates(): void {
    const historyList = document.querySelector<HTMLUListElement>('.history-list');

    if (!historyList) {
        return;
    }

    const updateHistoryEmpty = () => {
        updateEmptyState(historyList, '.history-item:not(.empty-state)', {
            icon: 'history',
            title: 'No history',
            subtitle: 'Label actions will appear here',
            className: 'history-empty',
        });
    };

    // Set up observer for history list only
    const historyObserver = new MutationObserver(updateHistoryEmpty);
    historyObserver.observe(historyList, { childList: true, subtree: true });

    // Initial update
    updateHistoryEmpty();
}
