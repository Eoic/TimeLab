import { installModalFocusTrap } from '@/utils/dom';
import { init, type EChartOption, type ECharts } from '@/vendor/echarts';

/**
 * Interface for time series data - clean abstraction for different data sources
 */
export interface TimeSeriesData {
    readonly id: string;
    readonly name: string;
    readonly columns: readonly string[];
    getData(xColumn: string, yColumn: string): Array<[number, number]>;
    isLabeled(): boolean;
    setLabeled(labeled: boolean): void;
}

/**
 * Events that the time series chart can emit
 */
export interface TimeSeriesEvents {
    'series-changed': { currentIndex: number; total: number };
    'label-changed': { index: number; labeled: boolean };
    'columns-available': { columns: readonly string[] };
}

/**
 * Configuration for time series display
 */
export interface TimeSeriesConfig {
    xColumn: string;
    yColumn: string;
}

/**
 * Main time series chart controller with clean separation of concerns
 */
export class TimeSeriesChart {
    private chart: ECharts | null = null;
    private dataSources: TimeSeriesData[] = [];
    private currentIndex = 0;
    private listeners = new Map<keyof TimeSeriesEvents, Array<(event: unknown) => void>>();
    private container: HTMLElement;
    private emptyStateElement: HTMLElement | null = null;
    private resizeTimeout: number | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private layoutChangeHandler: (() => void) | null = null;

    constructor(container: HTMLElement) {
        this.container = container;

        // Initialize chart with basic configuration
        const option: EChartOption = {
            tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
            grid: { left: 40, right: 16, top: 16, bottom: 65 },
            xAxis: { type: 'category', boundaryGap: true },
            yAxis: { type: 'value', scale: true, splitNumber: 4 },
            dataZoom: [
                { type: 'inside', xAxisIndex: 0 },
                {
                    type: 'slider',
                    xAxisIndex: 0,
                    bottom: 8,
                    start: 0,
                    end: 100,
                    throttle: 50,
                    showDetail: false,
                },
            ],
            series: [
                {
                    type: 'line',
                    name: 'Signal',
                    showSymbol: false,
                    smooth: true,
                    lineStyle: { width: 2 },
                    areaStyle: {},
                    data: [],
                },
            ],
        };

        void init(container as HTMLDivElement).then((chartInstance) => {
            this.chart = chartInstance;
            chartInstance.setOption(option);

            // Create empty state element AFTER chart is ready
            this.createEmptyStateElement();

            // Empty state is shown by default, hide it only if we have data
            this.updateEmptyState(this.dataSources.length === 0);
        });

        // Empty state will be created after chart initialization

        // Handle window resize and layout changes
        const onResize = () => {
            if (this.chart) {
                this.chart.resize();
            }
        };
        window.addEventListener('resize', onResize);

        // Listen for layout changes (when panels are toggled)
        this.resizeObserver = new ResizeObserver(() => {
            // Debounce resize calls
            if (this.resizeTimeout) {
                clearTimeout(this.resizeTimeout);
            }
            this.resizeTimeout = window.setTimeout(() => {
                if (this.chart) {
                    this.chart.resize();
                }
            }, 100);
        });
        this.resizeObserver.observe(container);

        // Listen for explicit layout change events from panel toggles
        this.layoutChangeHandler = () => {
            if (this.resizeTimeout) {
                clearTimeout(this.resizeTimeout);
            }
            this.resizeTimeout = window.setTimeout(() => {
                if (this.chart) {
                    this.chart.resize();
                }
            }, 150); // Slightly longer delay for panel animations
        };
        window.addEventListener('timelab:layoutChanged', this.layoutChangeHandler);
    }

    /**
     * Create the HTML empty state overlay
     */
    private createEmptyStateElement(): void {
        this.emptyStateElement = document.createElement('div');
        this.emptyStateElement.className = 'chart-empty-state';
        this.emptyStateElement.innerHTML = `
            <div class="empty-state-content">
                <span class="material-symbols-outlined empty-icon">monitoring</span>
                <h3 class="empty-title">No data available</h3>
                <p class="empty-subtitle">Upload CSV to view time series data</p>
            </div>
        `;

        // Position absolutely over the chart
        this.emptyStateElement.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--color-bg-primary, #ffffff);
            z-index: 100;
        `;

        // Make container relative if it isn't already
        const containerStyle = window.getComputedStyle(this.container);
        if (containerStyle.position === 'static') {
            this.container.style.position = 'relative';
        }

        this.container.appendChild(this.emptyStateElement);
    }

    /**
     * Add event listener
     */
    on<K extends keyof TimeSeriesEvents>(
        event: K,
        listener: (data: TimeSeriesEvents[K]) => void
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
    off<K extends keyof TimeSeriesEvents>(
        event: K,
        listener: (data: TimeSeriesEvents[K]) => void
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
    private emit<K extends keyof TimeSeriesEvents>(event: K, data: TimeSeriesEvents[K]): void {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            eventListeners.forEach((listener) => {
                listener(data);
            });
        }
    }

    /**
     * Set data sources for the chart
     */
    setDataSources(sources: TimeSeriesData[]): void {
        this.dataSources = [...sources];
        this.currentIndex = Math.min(this.currentIndex, Math.max(0, sources.length - 1));

        // Show empty state or hide it based on data availability
        this.updateEmptyState(sources.length === 0);

        // Emit available columns from current source
        const currentSource = this.getCurrentSource();
        if (currentSource) {
            this.emit('columns-available', { columns: currentSource.columns });
        } else {
            this.emit('columns-available', { columns: [] });
        }

        this.emit('series-changed', {
            currentIndex: this.currentIndex,
            total: this.dataSources.length,
        });
    }

    /**
     * Update empty state display and UI visibility
     */
    private updateEmptyState(showEmpty: boolean): void {
        if (!this.emptyStateElement) return;

        this.emptyStateElement.style.display = showEmpty ? 'flex' : 'none';

        // Update UI element visibility based on data availability
        this.updateUIVisibility(!showEmpty);

        // Don't hide the chart itself - let ECharts handle its own display
        // The empty state overlay will appear on top when needed
    }

    /**
     * Update visibility of UI elements based on data availability
     */
    private updateUIVisibility(hasData: boolean): void {
        // Chart toolbar visibility
        const chartTools = document.querySelector('.chart .tools') as HTMLElement;
        chartTools.style.display = hasData ? 'flex' : 'none';
        chartTools.setAttribute('aria-hidden', hasData ? 'false' : 'true');

        // Update tabindex to make it unfocusable when hidden
        const toolButtons = chartTools.querySelectorAll('button');
        toolButtons.forEach((button) => {
            button.tabIndex = hasData ? 0 : -1;
        });

        // Labeled/unlabeled toggle button visibility
        const labeledToggle = document.getElementById('toggle-labeled') as HTMLElement;
        labeledToggle.style.display = hasData ? 'flex' : 'none';
        labeledToggle.setAttribute('aria-hidden', hasData ? 'false' : 'true');
        (labeledToggle as HTMLButtonElement).tabIndex = hasData ? 0 : -1;
    }

    /**
     * Get current data source
     */
    getCurrentSource(): TimeSeriesData | null {
        return this.dataSources[this.currentIndex] || null;
    }

    /**
     * Navigate to previous series
     */
    previousSeries(): void {
        if (this.dataSources.length <= 1) return;
        this.currentIndex =
            (this.currentIndex - 1 + this.dataSources.length) % this.dataSources.length;
        this.emit('series-changed', {
            currentIndex: this.currentIndex,
            total: this.dataSources.length,
        });
    }

    /**
     * Navigate to next series
     */
    nextSeries(): void {
        if (this.dataSources.length <= 1) return;
        this.currentIndex = (this.currentIndex + 1) % this.dataSources.length;
        this.emit('series-changed', {
            currentIndex: this.currentIndex,
            total: this.dataSources.length,
        });
    }

    /**
     * Go to specific series by index
     */
    goToSeries(index: number): void {
        if (index >= 0 && index < this.dataSources.length) {
            this.currentIndex = index;
            this.emit('series-changed', {
                currentIndex: this.currentIndex,
                total: this.dataSources.length,
            });
        }
    }

    /**
     * Toggle labeled state of current series
     */
    toggleLabeled(): void {
        const source = this.getCurrentSource();
        if (source) {
            const newState = !source.isLabeled();
            source.setLabeled(newState);
            this.emit('label-changed', { index: this.currentIndex, labeled: newState });
        }
    }

    /**
     * Update chart display with current configuration
     */
    updateDisplay(config: TimeSeriesConfig): void {
        const source = this.getCurrentSource();

        // If no data sources at all, always show empty state
        if (this.dataSources.length === 0) {
            this.chart?.setOption({ series: [{ data: [] }] });
            this.updateEmptyState(true);
            return;
        }

        if (!source || !this.chart) {
            this.chart?.setOption({ series: [{ data: [] }] });
            this.updateEmptyState(true);
            return;
        }

        const data = source.getData(config.xColumn, config.yColumn);
        this.chart.setOption(
            {
                series: [{ data }],
                dataZoom: [{ start: 0, end: 100 }],
            },
            false,
            true
        );
        this.updateEmptyState(false);
    }

    /**
     * Get the underlying ECharts instance for advanced configuration
     */
    getChart(): ECharts | null {
        return this.chart;
    }

    /**
     * Get all available columns from current data source
     */
    getAvailableColumns(): readonly string[] {
        const source = this.getCurrentSource();
        return source ? source.columns : [];
    }

    /**
     * Get current series information
     */
    getCurrentSeriesInfo(): { index: number; total: number; labeled: boolean } {
        const source = this.getCurrentSource();
        return {
            index: this.currentIndex,
            total: this.dataSources.length,
            labeled: source ? source.isLabeled() : false,
        };
    }

    /**
     * Clean up resources
     */
    dispose(): void {
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = null;
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        if (this.layoutChangeHandler) {
            window.removeEventListener('timelab:layoutChanged', this.layoutChangeHandler);
            this.layoutChangeHandler = null;
        }
        if (this.chart) {
            this.chart.dispose();
            this.chart = null;
        }
        if (this.emptyStateElement) {
            this.emptyStateElement.remove();
            this.emptyStateElement = null;
        }
    }
}

/**
 * Data manager interface for handling uploads and storage
 */
export interface DataManager {
    /**
     * Get all available data sources
     */
    getDataSources(): Promise<TimeSeriesData[]>;

    /**
     * Subscribe to data changes
     */
    onDataChanged(callback: (sources: TimeSeriesData[]) => void): void;

    /**
     * Remove data change subscription
     */
    offDataChanged(callback: (sources: TimeSeriesData[]) => void): void;
}

// UI Helper Functions for integration with existing UI
function bindUIControls(chart: TimeSeriesChart): void {
    const elPrev = document.getElementById('series-prev') as HTMLButtonElement | null;
    const elNext = document.getElementById('series-next') as HTMLButtonElement | null;
    const btnToggleLabeled = document.getElementById('toggle-labeled') as HTMLButtonElement | null;

    elPrev?.addEventListener('click', () => {
        chart.previousSeries();
    });
    elNext?.addEventListener('click', () => {
        chart.nextSeries();
    });
    btnToggleLabeled?.addEventListener('click', () => {
        chart.toggleLabeled();
    });

    // Bind axis dropdown changes
    const xDropdown = document.querySelector('#x-axis');
    const yDropdown = document.querySelector('#y-axis');

    const updateChart = () => {
        // Don't update chart if we have no data sources at all
        const seriesInfo = chart.getCurrentSeriesInfo();
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

        const xColumn = (xDropdown as HTMLSelectElement).value || 'index';
        const yColumn = (yDropdown as HTMLSelectElement).value || 'value';

        // Only update if we have valid column values
        if (xColumn && yColumn && xColumn !== '' && yColumn !== '') {
            chart.updateDisplay({ xColumn, yColumn });
        }
    };

    xDropdown?.addEventListener('change', updateChart);
    yDropdown?.addEventListener('change', updateChart);
}

function bindSeriesModal(chart: TimeSeriesChart): void {
    const btnGrid = document.getElementById('series-grid') as HTMLButtonElement | null;
    const modal = document.getElementById('modal-series-selector');
    const modalClose = document.getElementById('series-modal-close');

    btnGrid?.addEventListener('click', () => {
        openSeriesModal(chart);
    });
    modalClose?.addEventListener('click', () => {
        closeSeriesModal();
    });

    modal?.addEventListener('click', (ev) => {
        const target = ev.target as HTMLElement | null;
        if (!target) return;
        if (target.hasAttribute('data-close') || target === modal) {
            closeSeriesModal();
        }
    });

    if (modal) {
        installModalFocusTrap(modal, closeSeriesModal);
    }
}

function updateSeriesIndicator(current: number, total: number): void {
    const elIndicator = document.getElementById('series-indicator');
    if (elIndicator) {
        elIndicator.textContent = total > 0 ? `${String(current + 1)} / ${String(total)}` : '0 / 0';
    }
}

function updateSeriesNavigationButtons(total: number): void {
    const elPrev = document.getElementById('series-prev') as HTMLButtonElement | null;
    const elNext = document.getElementById('series-next') as HTMLButtonElement | null;

    if (elPrev) elPrev.disabled = total <= 1;
    if (elNext) elNext.disabled = total <= 1;
}

function updateLabeledButton(labeled: boolean): void {
    const btnToggleLabeled = document.getElementById('toggle-labeled') as HTMLButtonElement | null;
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

function updateColumnDropdowns(columns: readonly string[]): void {
    // This function is now handled by the dropdown system in ui/dropdowns.ts
    // Just trigger the event for the dropdown system to handle
    const event = new CustomEvent('timelab:columnsAvailable', {
        detail: { columns: Array.from(columns) },
    });
    window.dispatchEvent(event);
}

function openSeriesModal(chart: TimeSeriesChart): void {
    const modal = document.getElementById('modal-series-selector');
    if (!modal) return;

    renderSeriesGrid(chart);
    modal.setAttribute('aria-hidden', 'false');

    setTimeout(() => {
        const active = modal.querySelector(
            '.series-cell[aria-selected="true"]'
        ) as HTMLButtonElement;
        active.focus();
    }, 0);
}

function closeSeriesModal(): void {
    const modal = document.getElementById('modal-series-selector');
    const btnGrid = document.getElementById('series-grid') as HTMLButtonElement | null;

    if (modal) {
        modal.setAttribute('aria-hidden', 'true');
    }
    btnGrid?.focus();
}

function renderSeriesGrid(chart: TimeSeriesChart): void {
    const modalGrid = document.getElementById('series-grid-container');
    if (!modalGrid) return;

    modalGrid.textContent = '';
    const info = chart.getCurrentSeriesInfo();

    if (info.total === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-state';
        emptyMessage.textContent = 'No series available';
        modalGrid.appendChild(emptyMessage);
        return;
    }

    for (let i = 0; i < info.total; i++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'series-cell'; // labeled class would be added based on data
        btn.setAttribute('role', 'option');
        btn.setAttribute('aria-selected', String(i === info.index));
        btn.dataset.index = String(i);
        btn.tabIndex = i === info.index ? 0 : -1;

        const num = document.createElement('span');
        num.className = 'num';
        num.textContent = String(i + 1);

        btn.appendChild(num);
        btn.addEventListener('click', () => {
            chart.goToSeries(i);
            closeSeriesModal();
        });
        modalGrid.appendChild(btn);
    }
}

function updateSeriesModalIfOpen(chart: TimeSeriesChart): void {
    const modal = document.getElementById('modal-series-selector');
    if (modal && modal.getAttribute('aria-hidden') !== 'true') {
        renderSeriesGrid(chart);
    }
}

/**
 * Initialize chart with clean empty state
 */
export function initializeTimeSeriesChart(): TimeSeriesChart {
    const container = document.getElementById('chart-canvas');
    if (!container) {
        throw new Error('Chart container #chart-canvas not found');
    }

    const chart = new TimeSeriesChart(container);

    // Bind UI controls
    bindUIControls(chart);
    bindSeriesModal(chart);

    // Set up event listeners
    chart.on('series-changed', (event) => {
        updateSeriesIndicator(event.currentIndex, event.total);
        updateSeriesNavigationButtons(event.total);
        updateLabeledButton(chart.getCurrentSeriesInfo().labeled);
    });

    chart.on('label-changed', (event) => {
        updateLabeledButton(event.labeled);
        updateSeriesModalIfOpen(chart);
    });

    chart.on('columns-available', (event) => {
        updateColumnDropdowns(event.columns);
    });

    // Initialize with empty state
    chart.setDataSources([]);

    return chart;
}
