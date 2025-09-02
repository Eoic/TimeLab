export function setupCollapsiblePanels(): void {
    const root = document.querySelector<HTMLDivElement>('.container');

    if (!root) {
        return;
    }

    const toggleConfigButton = document.querySelector<HTMLButtonElement>(
        "[data-action='toggle-config']"
    );
    const toggleLabelsButton = document.querySelector<HTMLButtonElement>(
        "[data-action='toggle-labctrl']"
    );
    const toggleStatsButton = document.querySelector<HTMLButtonElement>(
        "[data-action='toggle-stats']"
    );
    const configPanel = document.getElementById('panel-config');
    const labelsPanel = document.getElementById('panel-labctrl');
    const statsPanel = document.getElementById('panel-stats');

    const updateAriaAndIcons = () => {
        const leftCollapsed = root.classList.contains('collapse-left');
        const rightCollapsed = root.classList.contains('collapse-right');
        const bottomCollapsed = root.classList.contains('collapse-bottom');
        if (toggleConfigButton) {
            toggleConfigButton.setAttribute('aria-expanded', String(!leftCollapsed));
            const icon = toggleConfigButton.querySelector('.material-symbols-outlined');
            if (icon) {
                icon.textContent = leftCollapsed ? 'left_panel_open' : 'left_panel_close';
            }
            toggleConfigButton.setAttribute(
                'aria-label',
                leftCollapsed ? 'Expand configuration panel' : 'Collapse configuration panel'
            );
        }
        if (toggleLabelsButton) {
            toggleLabelsButton.setAttribute('aria-expanded', String(!rightCollapsed));
            const icon = toggleLabelsButton.querySelector('.material-symbols-outlined');
            if (icon) {
                icon.textContent = rightCollapsed ? 'right_panel_open' : 'right_panel_close';
            }
            toggleLabelsButton.setAttribute(
                'aria-label',
                rightCollapsed ? 'Expand labels panel' : 'Collapse labels panel'
            );
        }
        if (toggleStatsButton) {
            toggleStatsButton.setAttribute('aria-expanded', String(!bottomCollapsed));
            const icon = toggleStatsButton.querySelector('.material-symbols-outlined');
            if (icon) {
                icon.textContent = bottomCollapsed ? 'bottom_panel_open' : 'bottom_panel_close';
            }
            toggleStatsButton.setAttribute(
                'aria-label',
                bottomCollapsed ? 'Expand statistics panel' : 'Collapse statistics panel'
            );
        }
    };

    const resizeChartSoon = () => {
        // Try the old global first for backward compatibility
        const chart = (window as unknown as { __timestudioChart?: { resize: () => void } })
            .__timestudioChart;
        if (chart) {
            // Use immediate resize + animation frame for smooth transition
            chart.resize();
            requestAnimationFrame(() => {
                chart.resize();
            });
            // One more resize after CSS transition completes (200ms)
            setTimeout(() => {
                chart.resize();
            }, 220);
        }

        // Also emit a custom event for new chart implementations
        const resizeEvent = new CustomEvent('timelab:layoutChanged');
        window.dispatchEvent(resizeEvent);
    };

    const togglePanel = (
        className: 'collapse-left' | 'collapse-right' | 'collapse-bottom',
        panel: HTMLElement | null
    ) => {
        root.classList.toggle(className);
        if (root.classList.contains(className) && panel?.contains(document.activeElement)) {
            const target = document.getElementById('chart-canvas');
            if (target instanceof HTMLElement) {
                target.focus();
            }
        }
        updateAriaAndIcons();
        resizeChartSoon();
    };

    toggleConfigButton?.addEventListener('click', () => {
        togglePanel('collapse-left', configPanel);
    });
    toggleLabelsButton?.addEventListener('click', () => {
        togglePanel('collapse-right', labelsPanel);
    });
    toggleStatsButton?.addEventListener('click', () => {
        togglePanel('collapse-bottom', statsPanel);
    });

    const stackedQuery = window.matchMedia('(max-width: 1199px)');

    const handleStackedChange = (matches: boolean): void => {
        if (matches) {
            root.classList.remove('collapse-left', 'collapse-right', 'collapse-bottom');
            updateAriaAndIcons();
            resizeChartSoon();
        }
    };

    handleStackedChange(stackedQuery.matches);
    stackedQuery.addEventListener('change', (event: MediaQueryListEvent) => {
        handleStackedChange(event.matches);
    });

    updateAriaAndIcons();
}
