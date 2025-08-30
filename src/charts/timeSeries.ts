import { installModalFocusTrap } from '../ui/dom';

import { init, type EChartOption, type ECharts } from './echarts';

interface DataZoomEvent {
    readonly start?: number;
    readonly end?: number;
}

/**
 * Interface for time series data - clean abstraction for different data sources
 */
export interface TimeSeriesData {
    readonly id: string;
    readonly name: string;
    readonly columns: readonly string[];
    getData(xColumn: string, yColumn: string): ReadonlyArray<readonly [number, number]>;
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
    // Chart appearance
    smooth?: boolean;
    showArea?: boolean;
    lineWidth?: number;
    showPoints?: boolean;
    sampling?: 'lttb' | 'average' | 'max' | 'min' | undefined;
    // Axes
    xType?: 'category' | 'time' | 'value';
    yType?: 'value' | 'log';
    yAuto?: boolean;
    yMin?: number;
    yMax?: number;
    showGridlines?: boolean;
    // Tooltip and interaction
    tooltipMode?: 'axis' | 'item' | 'none';
    snap?: boolean;
    // Threshold
    thresholdEnabled?: boolean;
    thresholdValue?: number;
}

/**
 * Main time series chart controller with clean separation of concerns
 */
export class TimeSeriesChart {
    private chart: ECharts | null = null;
    private dataSources: ReadonlyArray<TimeSeriesData> = [];
    private currentIndex = 0;
    private listeners = new Map<keyof TimeSeriesEvents, Array<(event: unknown) => void>>();
    private container: HTMLElement;
    private emptyStateElement: HTMLElement | null = null;
    private resizeTimeout: number | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private layoutChangeHandler: (() => void) | null = null;
    private chartConfigCleanup: (() => void) | null = null;
    private lastConfig: TimeSeriesConfig | null = null;
    private currentData: ReadonlyArray<readonly [number | string, number]> = [];
    private readonly handleZoomEvent = (params: DataZoomEvent): void => {
        this.updateYAxisFromZoom(params.start, params.end);
    };

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
                    // Don't set smooth or areaStyle here - let updateDisplay handle it
                    lineStyle: { width: 2 },
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

            // Initialize chart configuration controls
            this.initializeConfigControls();

            chartInstance.on('dataZoom', this.handleZoomEvent);
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
            z-index: 100;
            margin: -1rem;
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
    setDataSources(sources: readonly TimeSeriesData[]): void {
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

        // Series navigation controls visibility
        const seriesPrev = document.getElementById('series-prev');
        const seriesNext = document.getElementById('series-next');
        const seriesIndicator = document.getElementById('series-indicator');
        const seriesGrid = document.getElementById('series-grid');

        [seriesPrev, seriesNext, seriesIndicator, seriesGrid].forEach((element) => {
            if (element) {
                element.style.display = hasData ? '' : 'none';
                element.setAttribute('aria-hidden', hasData ? 'false' : 'true');
                if (element instanceof HTMLButtonElement) {
                    element.tabIndex = hasData ? 0 : -1;
                }
            }
        });
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

        // Emit columns available for the new current source
        const currentSource = this.getCurrentSource();
        if (currentSource) {
            this.emit('columns-available', { columns: currentSource.columns });
        }
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

        // Emit columns available for the new current source
        const currentSource = this.getCurrentSource();
        if (currentSource) {
            this.emit('columns-available', { columns: currentSource.columns });
        }
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

            // Emit columns available for the new current source
            const currentSource = this.getCurrentSource();
            if (currentSource) {
                this.emit('columns-available', { columns: currentSource.columns });
            }
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
        // Store the configuration for future reference
        this.lastConfig = { ...config };

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

        // Apply configuration with defaults
        const xType = config.xType || 'category';
        const yType = config.yType || 'value';
        const showGrid = config.showGridlines ?? true;
        const smooth = config.smooth ?? true;
        const showArea = config.showArea ?? false;
        const showSymbol = config.showPoints ?? false;
        const lineWidth = config.lineWidth ?? 2;
        const sampling = config.sampling;
        const tooltipMode = config.tooltipMode ?? 'axis';
        const snap = config.snap ?? false;
        const yAuto = config.yAuto ?? true;

        // Process data based on x-axis type
        let seriesData: ReadonlyArray<readonly [number | string, number]> = data;
        if (xType === 'category') {
            seriesData = data.map((_pair, i) => [String(i), data[i]?.[1] ?? NaN] as const);
        }

        // Configure axes
        const xAxis: EChartOption.XAxis = {
            type: xType as EChartOption.XAxis['type'],
            boundaryGap: xType === 'category',
            axisLine: showGrid ? {} : { show: false },
            splitLine: { show: showGrid },
        };

        const yAxis: EChartOption.YAxis = {
            type: yType as EChartOption.YAxis['type'],
            scale: yAuto,
            axisLine: showGrid ? {} : { show: false },
            splitLine: { show: showGrid },
        };

        // Apply manual Y-axis range if not auto
        if (!yAuto) {
            if (config.yMin !== undefined) {
                yAxis.min = config.yMin;
            }
            if (config.yMax !== undefined) {
                yAxis.max = config.yMax;
            }
        }

        // Configure threshold line
        let markLine: EChartOption.SeriesLine['markLine'] | undefined;
        if (config.thresholdEnabled && config.thresholdValue !== undefined) {
            markLine = {
                data: [{ yAxis: config.thresholdValue }],
                lineStyle: { type: 'dashed' },
                symbol: 'none',
            } as unknown as EChartOption.SeriesLine['markLine'];
        }

        // Configure tooltip
        const tooltip =
            tooltipMode === 'none'
                ? { show: false }
                : {
                      trigger: tooltipMode as EChartOption.Tooltip['trigger'],
                      axisPointer: { type: 'cross' as const, snap },
                  };

        this.chart.setOption(
            {
                tooltip,
                xAxis,
                yAxis,
                series: [
                    {
                        type: 'line',
                        name: 'Signal',
                        smooth,
                        showSymbol,
                        sampling,
                        lineStyle: { width: lineWidth },
                        areaStyle: showArea ? {} : undefined,
                        markLine,
                        data: [...seriesData] as Array<[number | string, number]>,
                    },
                ],
            },
            false,
            true
        );
        this.currentData = seriesData;
        this.updateYAxisFromZoom();
        this.updateEmptyState(false);
    }

    private updateYAxisFromZoom(start?: number, end?: number): void {
        if (!this.chart || !this.lastConfig?.yAuto || this.currentData.length === 0) {
            return;
        }

        type ZoomOption = { start: number; end: number };
        const zoomOpts = this.chart.getOption().dataZoom as ReadonlyArray<ZoomOption> | undefined;
        const s = start ?? zoomOpts?.[0]?.start ?? 0;
        const e = end ?? zoomOpts?.[0]?.end ?? 100;

        const len = this.currentData.length;
        const startIdx = Math.max(0, Math.floor((s / 100) * (len - 1)));
        const endIdx = Math.min(len - 1, Math.ceil((e / 100) * (len - 1)));

        let min = Number.POSITIVE_INFINITY;
        let max = Number.NEGATIVE_INFINITY;
        for (let i = startIdx; i <= endIdx; i++) {
            const point = this.currentData[i];
            if (!point) continue;
            const y = point[1];
            if (y < min) min = y;
            if (y > max) max = y;
        }
        if (!isFinite(min) || !isFinite(max)) {
            return;
        }
        const range = max - min;
        const padding = range === 0 ? Math.abs(min || 1) * 0.1 : range * 0.1;

        this.chart.setOption({
            yAxis: { min: min - padding, max: max + padding },
        });
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
     * Get the last used configuration
     */
    getLastConfig(): TimeSeriesConfig | null {
        return this.lastConfig;
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
        if (this.chartConfigCleanup) {
            this.chartConfigCleanup();
            this.chartConfigCleanup = null;
        }
        if (this.chart) {
            this.chart.off('dataZoom', this.handleZoomEvent);
            this.chart.dispose();
            this.chart = null;
        }
        if (this.emptyStateElement) {
            this.emptyStateElement.remove();
            this.emptyStateElement = null;
        }
    }

    /**
     * Initialize chart configuration controls
     */
    initializeConfigControls(): void {
        if (!this.chart) return;

        // Note: We handle configuration directly in our updateDisplay method
        // and listen for config changes in bindUIControls, so we don't need
        // to import the old config system that would conflict with our approach
    }
}

/**
 * Data manager interface for handling uploads and storage
 */
export interface DataManager {
    /**
     * Get all available data sources
     */
    getDataSources(): Promise<readonly TimeSeriesData[]>;

    /**
     * Subscribe to data changes
     */
    onDataChanged(callback: (sources: readonly TimeSeriesData[]) => void): void;

    /**
     * Remove data change subscription
     */
    offDataChanged(callback: (sources: readonly TimeSeriesData[]) => void): void;
}

// UI Helper Functions for integration with existing UI
/**
 * Get current chart configuration from all UI controls
 */
function getCurrentChartConfig(xColumn: string, yColumn: string): TimeSeriesConfig {
    // Get references to all config controls
    const elSmooth = document.querySelector<HTMLInputElement>('#cfg-smooth');
    const elArea = document.querySelector<HTMLInputElement>('#cfg-area');
    const elLineWidth = document.querySelector<HTMLInputElement>('#cfg-linewidth');
    const elPoints = document.querySelector<HTMLInputElement>('#cfg-points');
    const elSampling = document.querySelector('#cfg-sampling');
    const elXType = document.querySelector('#cfg-x-type');
    const elYType = document.querySelector('#cfg-y-type');
    const elYAuto = document.querySelector<HTMLInputElement>('#cfg-y-auto');
    const elYMin = document.querySelector<HTMLInputElement>('#cfg-y-min');
    const elYMax = document.querySelector<HTMLInputElement>('#cfg-y-max');
    const elGridlines = document.querySelector<HTMLInputElement>('#cfg-gridlines');
    const elTooltip = document.querySelector('#cfg-tooltip');
    const elSnap = document.querySelector<HTMLInputElement>('#cfg-snap');
    const elThreshEnable = document.querySelector<HTMLInputElement>('#cfg-threshold-enable');
    const elThreshValue = document.querySelector<HTMLInputElement>('#cfg-threshold-value');

    // Helper to get sampling value
    const samplingValue = elSampling ? (elSampling as { value?: string }).value : undefined;
    const sampling: 'lttb' | 'average' | 'max' | 'min' | undefined =
        samplingValue && ['lttb', 'average', 'max', 'min'].includes(samplingValue)
            ? (samplingValue as 'lttb' | 'average' | 'max' | 'min')
            : undefined;

    // Helper to get xType value
    const xTypeValue = elXType ? (elXType as { value?: string }).value : undefined;
    const xType: 'category' | 'time' | 'value' =
        xTypeValue && ['category', 'time', 'value'].includes(xTypeValue)
            ? (xTypeValue as 'category' | 'time' | 'value')
            : 'category';

    // Helper to get yType value
    const yTypeValue = elYType ? (elYType as { value?: string }).value : undefined;
    const yType: 'value' | 'log' = yTypeValue === 'log' ? 'log' : 'value';

    // Helper to get tooltip mode
    const tooltipValue = elTooltip ? (elTooltip as { value?: string }).value : undefined;
    const tooltipMode: 'axis' | 'item' | 'none' =
        tooltipValue && ['axis', 'item', 'none'].includes(tooltipValue)
            ? (tooltipValue as 'axis' | 'item' | 'none')
            : 'axis';

    // Check if Y auto-scaling is disabled
    const yAutoDisabled = !elYAuto?.checked;
    const yMinValue =
        yAutoDisabled && elYMin?.value !== '' && elYMin?.value != null
            ? Number(elYMin.value)
            : undefined;
    const yMaxValue =
        yAutoDisabled && elYMax?.value !== '' && elYMax?.value != null
            ? Number(elYMax.value)
            : undefined;
    const thresholdValue =
        elThreshEnable?.checked && elThreshValue?.value !== '' && elThreshValue?.value != null
            ? Number(elThreshValue.value)
            : undefined;

    // Build configuration object
    const config: TimeSeriesConfig = {
        xColumn,
        yColumn,
        // Chart appearance
        smooth: elSmooth?.checked ?? true,
        showArea: elArea?.checked ?? true, // Default to true to match HTML checked state
        lineWidth: Number(elLineWidth?.value) || 2,
        showPoints: elPoints?.checked ?? false,
        ...(sampling && { sampling }),
        // Axes
        xType,
        yType,
        yAuto: elYAuto?.checked ?? true,
        ...(yMinValue !== undefined && { yMin: yMinValue }),
        ...(yMaxValue !== undefined && { yMax: yMaxValue }),
        showGridlines: elGridlines?.checked ?? true,
        // Tooltip and interaction
        tooltipMode,
        snap: elSnap?.checked ?? false,
        // Threshold
        thresholdEnabled: elThreshEnable?.checked ?? false,
        ...(thresholdValue !== undefined && { thresholdValue }),
    };

    return config;
}

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
            // Get current configuration from all UI controls
            const config = getCurrentChartConfig(xColumn, yColumn);
            chart.updateDisplay(config);
        }
    };

    // Auto-update chart when data becomes available
    const autoUpdateOnDataAvailable = () => {
        const seriesInfo = chart.getCurrentSeriesInfo();
        if (seriesInfo.total > 0) {
            // Small delay to ensure dropdowns are populated
            setTimeout(updateChart, 100);
        }
    };

    xDropdown?.addEventListener('change', updateChart);
    yDropdown?.addEventListener('change', updateChart);

    // Auto-update when data sources change
    chart.on('series-changed', autoUpdateOnDataAvailable);
    chart.on('columns-available', autoUpdateOnDataAvailable);

    // Listen for automatic axis option updates
    window.addEventListener('timelab:axisOptionsUpdated', (event) => {
        const customEvent = event as CustomEvent<{ xColumn: string; yColumn: string }>;
        const { xColumn, yColumn } = customEvent.detail;
        if (xColumn && yColumn) {
            // Get current configuration from all UI controls
            const config = getCurrentChartConfig(xColumn, yColumn);
            chart.updateDisplay(config);
        }
    });

    // Listen for chart configuration changes to trigger updates
    const configElements = [
        '#cfg-smooth',
        '#cfg-area',
        '#cfg-linewidth',
        '#cfg-points',
        '#cfg-sampling',
        '#cfg-x-type',
        '#cfg-y-type',
        '#cfg-y-auto',
        '#cfg-y-min',
        '#cfg-y-max',
        '#cfg-gridlines',
        '#cfg-tooltip',
        '#cfg-snap',
        '#cfg-threshold-enable',
        '#cfg-threshold-value',
    ];

    const onConfigChange = () => {
        const lastConfig = chart.getLastConfig();
        if (lastConfig) {
            const config = getCurrentChartConfig(lastConfig.xColumn, lastConfig.yColumn);
            chart.updateDisplay(config);
        }
    };

    configElements.forEach((selector) => {
        const element = document.querySelector(selector);
        if (element) {
            element.addEventListener('change', onConfigChange);
            element.addEventListener('input', onConfigChange);
        }
    });
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
        emptyMessage.textContent = 'No series available.';
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
