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

    // Expose functions for testing (can be removed in production)
    (
        window as unknown as {
            addTestLabel?: () => void;
            addTestHistory?: () => void;
        }
    ).addTestLabel = () => {
        const labelsList = document.querySelector<HTMLUListElement>('.labels-list');
        if (!labelsList) return;

        const testLabel = document.createElement('li');
        testLabel.className = 'label-item';
        testLabel.innerHTML = `
            <span class="dot" style="--dot: #e74c3c"></span>
            <div class="meta">
                <div class="title">Test Label</div>
                <div class="range text-sm text-muted">[100 – 250]</div>
            </div>
            <button class="btn-icon btn-ghost delete" aria-label="Delete label">
                <span class="material-symbols-outlined">delete</span>
            </button>
        `;
        labelsList.appendChild(testLabel);
    };

    (
        window as unknown as {
            addTestLabel?: () => void;
            addTestHistory?: () => void;
        }
    ).addTestHistory = () => {
        const testHistory = document.createElement('li');
        testHistory.className = 'history-item';
        testHistory.setAttribute('role', 'option');
        testHistory.setAttribute('aria-selected', 'false');
        testHistory.setAttribute('tabindex', '0');
        testHistory.innerHTML = `
            <div class="meta">
                <div class="title">Added Test Label</div>
                <div class="time text-sm text-muted">just now</div>
            </div>
        `;
        historyList.appendChild(testHistory);
    };
}
