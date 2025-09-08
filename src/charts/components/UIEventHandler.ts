import { installModalFocusTrap, closeModal } from '../../ui/dom';
import type { TimeSeriesChart } from '../timeSeries';

/**
 * Events emitted by the UI event handler
 */
export interface UIEventHandlerEvents {
    'series-navigate': { direction: 'prev' | 'next' };
    'series-selected': { index: number };
    'labeled-toggled': undefined;
    'label-mode-toggled': { enabled: boolean; labelDefId?: string };
    'label-definition-changed': { labelDefId: string | null };
    'axis-changed': { xColumn: string; yColumn: string };
}

/**
 * Manages UI event handling and interactions for the time series chart.
 * Centralizes all DOM event binding and user interactions.
 */
export class UIEventHandler {
    private chart: TimeSeriesChart | null = null;
    private listeners = new Map<keyof UIEventHandlerEvents, Array<(event: unknown) => void>>();
    private cleanupFunctions: Array<() => void> = [];

    /**
     * Initialize UI event handler
     */

    /**
     * Initialize with chart instance and bind all UI controls
     */
    initialize(chart: TimeSeriesChart): void {
        this.chart = chart;
        this.bindUIControls();
        this.bindSeriesModal();
    }

    /**
     * Add event listener
     */
    on<K extends keyof UIEventHandlerEvents>(
        event: K,
        listener: (data: UIEventHandlerEvents[K]) => void
    ): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            eventListeners.push(listener as (event: unknown) => void);
        }
    }

    /**
     * Remove event listener
     */
    off<K extends keyof UIEventHandlerEvents>(
        event: K,
        listener: (data: UIEventHandlerEvents[K]) => void
    ): void {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            const index = eventListeners.indexOf(listener as (event: unknown) => void);
            if (index >= 0) {
                eventListeners.splice(index, 1);
            }
        }
    }

    /**
     * Emit event to listeners
     */
    private emit<K extends keyof UIEventHandlerEvents>(
        event: K,
        data: UIEventHandlerEvents[K]
    ): void {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            eventListeners.forEach((listener) => {
                listener(data);
            });
        }
    }

    /**
     * Bind all UI controls and interactions
     */
    private bindUIControls(): void {
        if (!this.chart) return;

        this.bindSeriesNavigation();
        this.bindLabelControls();
        this.bindAxisControls();
    }

    /**
     * Bind series navigation controls
     */
    private bindSeriesNavigation(): void {
        const elPrev = document.getElementById('series-prev') as HTMLButtonElement | null;
        const elNext = document.getElementById('series-next') as HTMLButtonElement | null;
        const btnToggleLabeled = document.getElementById(
            'toggle-labeled'
        ) as HTMLButtonElement | null;

        if (elPrev) {
            const handler = () => {
                this.emit('series-navigate', { direction: 'prev' });
            };
            elPrev.addEventListener('click', handler);
            this.cleanupFunctions.push(() => {
                elPrev.removeEventListener('click', handler);
            });
        }

        if (elNext) {
            const handler = () => {
                this.emit('series-navigate', { direction: 'next' });
            };
            elNext.addEventListener('click', handler);
            this.cleanupFunctions.push(() => {
                elNext.removeEventListener('click', handler);
            });
        }

        if (btnToggleLabeled) {
            const handler = () => {
                this.emit('labeled-toggled', undefined);
            };
            btnToggleLabeled.addEventListener('click', handler);
            this.cleanupFunctions.push(() => {
                btnToggleLabeled.removeEventListener('click', handler);
            });
        }
    }

    /**
     * Bind label mode and definition controls
     */
    private bindLabelControls(): void {
        if (!this.chart) return;

        const btnLabelMode = document.getElementById('btn-label-mode') as HTMLButtonElement | null;
        const activeLabelDropdown = document.querySelector('#active-label');

        // Label mode toggle
        if (btnLabelMode) {
            const handler = () => {
                const isEnabled = this.chart?.isLabelModeEnabled() || false;
                const newState = !isEnabled;

                // Update button state
                btnLabelMode.setAttribute('aria-pressed', newState.toString());
                btnLabelMode.classList.toggle('active', newState);

                if (newState) {
                    // Get selected label from active-label dropdown
                    const selectedLabelValue =
                        (activeLabelDropdown as HTMLSelectElement)?.value || null;

                    if (!selectedLabelValue || selectedLabelValue === '') {
                        // No label selected, revert button state
                        btnLabelMode.setAttribute('aria-pressed', 'false');
                        btnLabelMode.classList.remove('active');
                        return;
                    }

                    // Enable label mode with selected label definition
                    this.emit('label-mode-toggled', {
                        enabled: true,
                        labelDefId: selectedLabelValue,
                    });
                } else {
                    // Disable label mode
                    this.emit('label-mode-toggled', { enabled: false });
                }
            };

            btnLabelMode.addEventListener('click', handler);
            this.cleanupFunctions.push(() => {
                btnLabelMode.removeEventListener('click', handler);
            });
        }

        // Listen for changes to the active label dropdown
        if (activeLabelDropdown) {
            const handler = () => {
                // If label mode is currently enabled, update the current label definition
                if (this.chart?.isLabelModeEnabled()) {
                    const selectedLabelValue =
                        (activeLabelDropdown as HTMLSelectElement).value || null;
                    this.emit('label-definition-changed', { labelDefId: selectedLabelValue });
                }
            };

            activeLabelDropdown.addEventListener('change', handler);
            this.cleanupFunctions.push(() => {
                activeLabelDropdown.removeEventListener('change', handler);
            });
        }
    }

    /**
     * Bind axis dropdown controls
     */
    private bindAxisControls(): void {
        const xDropdown = document.querySelector('#x-axis');
        const yDropdown = document.querySelector('#y-axis');

        const updateAxes = () => {
            if (!this.chart) return;

            // Don't update chart if we have no data sources at all
            const seriesInfo = this.chart.getCurrentSeriesInfo();
            if (seriesInfo.total === 0) {
                return;
            }

            // Don't update chart if dropdowns are in disabled state (no data available)
            const xElement = xDropdown as HTMLElement | null;
            const yElement = yDropdown as HTMLElement | null;
            if (
                xElement?.classList.contains('dropdown-disabled') ||
                yElement?.classList.contains('dropdown-disabled')
            ) {
                return;
            }

            const xColumn = (xDropdown as HTMLSelectElement | null)?.value || 'index';
            const yColumn = (yDropdown as HTMLSelectElement | null)?.value || 'value';

            // Only update if we have valid column values
            if (xColumn && yColumn && xColumn !== '' && yColumn !== '') {
                this.emit('axis-changed', { xColumn, yColumn });
            }
        };

        if (xDropdown) {
            xDropdown.addEventListener('change', updateAxes);
            this.cleanupFunctions.push(() => {
                xDropdown.removeEventListener('change', updateAxes);
            });
        }

        if (yDropdown) {
            yDropdown.addEventListener('change', updateAxes);
            this.cleanupFunctions.push(() => {
                yDropdown.removeEventListener('change', updateAxes);
            });
        }
    }

    /**
     * Bind series selector modal
     */
    private bindSeriesModal(): void {
        const btnGrid = document.getElementById('series-grid') as HTMLButtonElement | null;
        const modal = document.getElementById('modal-series-selector');
        const modalClose = document.getElementById('series-modal-close');

        if (btnGrid) {
            const handler = () => {
                this.openSeriesModal();
            };
            btnGrid.addEventListener('click', handler);
            this.cleanupFunctions.push(() => {
                btnGrid.removeEventListener('click', handler);
            });
        }

        if (modalClose) {
            const handler = () => {
                this.closeSeriesModal();
            };
            modalClose.addEventListener('click', handler);
            this.cleanupFunctions.push(() => {
                modalClose.removeEventListener('click', handler);
            });
        }

        if (modal) {
            const handler = (ev: Event) => {
                const target = ev.target as HTMLElement | null;
                if (!target) return;
                if (target.closest('[data-close]') || target === modal) {
                    this.closeSeriesModal();
                }
            };

            modal.addEventListener('click', handler);
            this.cleanupFunctions.push(() => {
                modal.removeEventListener('click', handler);
            });

            // Install focus trap
            installModalFocusTrap(modal, () => {
                this.closeSeriesModal();
            });
        }
    }

    /**
     * Open series selector modal
     */
    private openSeriesModal(): void {
        if (!this.chart) return;

        const modal = document.getElementById('modal-series-selector');
        if (!modal) return;

        this.renderSeriesGrid();
        modal.setAttribute('aria-hidden', 'false');

        setTimeout(() => {
            const active = modal.querySelector(
                '.series-cell[aria-selected="true"]'
            ) as HTMLButtonElement;
            active?.focus();
        }, 0);
    }

    /**
     * Close series selector modal
     */
    private closeSeriesModal(): void {
        const modal = document.getElementById('modal-series-selector');
        const btnGrid = document.getElementById('series-grid') as HTMLButtonElement | null;

        closeModal(modal);
        btnGrid?.focus();
    }

    /**
     * Render series grid in modal
     */
    renderSeriesGrid(): void {
        if (!this.chart) return;

        const modalGrid = document.getElementById('series-grid-container');
        if (!modalGrid) return;

        modalGrid.textContent = '';
        const info = this.chart.getCurrentSeriesInfo();

        if (info.total === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-state';
            emptyMessage.textContent = 'No series available.';
            modalGrid.appendChild(emptyMessage);
            return;
        }

        for (let i = 0; i < info.total; i++) {
            const btn = document.createElement('button');
            btn.type = 'button';

            // Check if this series is labeled
            const dataSource = this.chart.getDataSourceByIndex(i);
            const isLabeled = dataSource ? dataSource.isLabeled() : false;

            btn.className = isLabeled ? 'series-cell labeled' : 'series-cell';
            btn.setAttribute('role', 'option');
            btn.setAttribute('aria-selected', String(i === info.index));
            btn.dataset.index = String(i);
            btn.tabIndex = i === info.index ? 0 : -1;

            const num = document.createElement('span');
            num.className = 'num';
            num.textContent = String(i + 1);

            btn.appendChild(num);

            const handler = () => {
                this.emit('series-selected', { index: i });
                this.closeSeriesModal();
            };
            btn.addEventListener('click', handler);

            modalGrid.appendChild(btn);
        }
    }

    /**
     * Update series indicator display
     */
    updateSeriesIndicator(current: number, total: number): void {
        const elIndicator = document.getElementById('series-indicator');
        if (elIndicator) {
            elIndicator.textContent =
                total > 0 ? `${String(current + 1)} / ${String(total)}` : '0 / 0';
        }
    }

    /**
     * Update series navigation button states
     */
    updateSeriesNavigationButtons(total: number): void {
        const elPrev = document.getElementById('series-prev') as HTMLButtonElement | null;
        const elNext = document.getElementById('series-next') as HTMLButtonElement | null;

        if (elPrev) elPrev.disabled = total <= 1;
        if (elNext) elNext.disabled = total <= 1;
    }

    /**
     * Update labeled button state
     */
    updateLabeledButton(labeled: boolean): void {
        const btnToggleLabeled = document.getElementById(
            'toggle-labeled'
        ) as HTMLButtonElement | null;
        if (!btnToggleLabeled) return;

        btnToggleLabeled.setAttribute('aria-pressed', String(labeled));
        btnToggleLabeled.setAttribute(
            'aria-label',
            labeled ? 'Mark series as unlabeled' : 'Mark series as labeled'
        );
        btnToggleLabeled.setAttribute(
            'title',
            labeled ? 'Mark series as unlabeled' : 'Mark series as labeled'
        );

        const icon = btnToggleLabeled.querySelector('.material-symbols-outlined');
        const text = btnToggleLabeled.querySelector('.label');

        if (icon) {
            icon.textContent = labeled ? 'verified' : 'hourglass_empty';
        }
        if (text) {
            text.textContent = labeled ? 'Labeled' : 'Unlabeled';
        }
    }

    /**
     * Update column dropdowns with available columns
     */
    updateColumnDropdowns(columns: readonly string[]): void {
        // This function is now handled by the dropdown system in ui/dropdowns.ts
        // Just trigger the event for the dropdown system to handle
        const event = new CustomEvent('timelab:columnsAvailable', {
            detail: { columns: Array.from(columns) },
        });
        window.dispatchEvent(event);
    }

    /**
     * Clean up resources
     */
    dispose(): void {
        this.cleanupFunctions.forEach((cleanup) => {
            cleanup();
        });
        this.cleanupFunctions = [];
        this.listeners.clear();
    }
}
