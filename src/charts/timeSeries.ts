import type { TimeSeriesLabel } from '../domain/labels';
import type { Result } from '../shared/result';

import {
    LabelDrawingCanvas,
    ChartConfigurationManager,
    ChartRenderer,
    UIEventHandler,
} from './components';
import { init, type EChartOption, type ECharts } from './echarts';

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
    // Label management methods
    getLabels(): ReadonlyArray<TimeSeriesLabel>;
    addLabel(label: TimeSeriesLabel): void;
    removeLabel(labelId: string): void;
    toggleLabelVisibility(labelId: string): void;
    updateLabel(
        labelId: string,
        updates: Partial<Omit<TimeSeriesLabel, 'id' | 'datasetId' | 'createdAt'>>
    ): void;
}

/**
 * Events that the time series chart can emit
 */
export interface TimeSeriesEvents {
    'series-changed': { currentIndex: number; total: number };
    'label-changed': { index: number; labeled: boolean };
    'columns-available': { columns: readonly string[] };
    'label-drawn': { label: TimeSeriesLabel };
    'label-removed': { labelId: string };
    'label-mode-changed': { enabled: boolean };
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
 * Main time series chart controller using composition of focused components.
 * Each component has a single responsibility following SOLID principles.
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

    // Event handlers for proper cleanup
    private timeSeriesLabelsChangedHandler: (() => void) | null = null;
    private labelDefinitionsLoadedHandler: (() => void) | null = null;
    private labelModeForceDisabledHandler: (() => void) | null = null;

    // Composed components - each with a single responsibility
    private labelDrawingCanvas: LabelDrawingCanvas;
    private configManager: ChartConfigurationManager;
    private renderer: ChartRenderer;
    private uiHandler: UIEventHandler;

    // Label mode state
    private labelMode = false;
    private currentLabelDefId: string | null = null;
    private snapping = true; // Default to enabled

    constructor(container: HTMLElement) {
        this.container = container;

        // Initialize composed components
        this.labelDrawingCanvas = new LabelDrawingCanvas();
        this.configManager = new ChartConfigurationManager();
        this.renderer = new ChartRenderer();
        this.uiHandler = new UIEventHandler();

        // Setup component event listeners
        this.setupComponentEventListeners();

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
                    lineStyle: { width: 2 },
                    data: [],
                },
            ],
        };

        void init(container as HTMLDivElement).then((chartInstance) => {
            this.chart = chartInstance;
            chartInstance.setOption(option);

            // Initialize all components with the chart instance
            this.initializeComponents(chartInstance);

            // Create empty state element AFTER chart is ready
            this.createEmptyStateElement();

            // Empty state is shown by default, hide it only if we have data
            this.updateEmptyState(this.dataSources.length === 0);
        });

        // Setup resize and layout handling
        this.setupResizeHandling();

        // Listen for time series label changes (from label definition updates/deletions)
        this.timeSeriesLabelsChangedHandler = () => {
            // Refresh the chart to show updated/removed labels
            const lastConfig = this.configManager.getLastConfig();
            if (lastConfig) {
                this.updateDisplay(lastConfig);
            }
        };
        window.addEventListener(
            'timelab:timeSeriesLabelsChanged',
            this.timeSeriesLabelsChangedHandler
        );

        // Listen for label definitions being loaded (fixes labels not showing on page load)
        this.labelDefinitionsLoadedHandler = () => {
            // Refresh the chart to show existing labels with proper definitions
            const lastConfig = this.configManager.getLastConfig();
            if (lastConfig) {
                // Force a refresh by calling updateDisplay
                this.updateDisplay(lastConfig);
            }
            // Note: If no config yet, labels will be shown when config becomes available
        };
        window.addEventListener(
            'timelab:labelDefinitionsLoaded',
            this.labelDefinitionsLoadedHandler
        );

        // Listen for forced label mode disable (when all label definitions are deleted)
        this.labelModeForceDisabledHandler = () => {
            // Force exit label mode when no label definitions remain
            this.setLabelMode(false);
        };
        window.addEventListener(
            'timelab:labelModeForceDisabled',
            this.labelModeForceDisabledHandler
        );
    }

    /**
     * Initialize all components with chart instance
     */
    private initializeComponents(chartInstance: ECharts): void {
        this.labelDrawingCanvas.initialize(chartInstance);
        this.renderer.initialize(chartInstance);
        this.uiHandler.initialize(this);

        // Initialize snap button state to match default
        this.uiHandler.initializeSnapButton(this.snapping);
    }

    /**
     * Setup event listeners between components
     */
    private setupComponentEventListeners(): void {
        // Label drawing canvas events
        this.labelDrawingCanvas.on('label-drawn', (event) => {
            const source = this.getCurrentSource();
            if (source) {
                source.addLabel(event.label);
                this.emit('label-drawn', event);

                // Refresh display to show new label
                const lastConfig = this.configManager.getLastConfig();
                if (lastConfig) {
                    this.updateDisplay(lastConfig);
                }
            }
        });

        // Configuration manager events
        this.configManager.on('config-changed', (event) => {
            this.updateDisplay(event.config);
        });

        // Renderer events
        this.renderer.on('zoom-changed', (event) => {
            const lastConfig = this.configManager.getLastConfig();
            if (lastConfig?.yAuto) {
                this.renderer.updateYAxisFromZoom(event.start, event.end);
            }
        });

        // UI handler events
        this.uiHandler.on('series-navigate', (event) => {
            if (event.direction === 'prev') {
                this.previousSeries();
            } else {
                this.nextSeries();
            }
        });

        this.uiHandler.on('series-selected', (event) => {
            this.goToSeries(event.index);
        });

        this.uiHandler.on('labeled-toggled', () => {
            this.toggleLabeled();
        });

        this.uiHandler.on('label-mode-toggled', (event) => {
            this.setLabelMode(event.enabled, event.labelDefId);
        });

        this.uiHandler.on('label-definition-changed', (event) => {
            this.setCurrentLabelDefinition(event.labelDefId);
        });

        this.uiHandler.on('axis-changed', (event) => {
            const config = this.configManager.getCurrentConfig(event.xColumn, event.yColumn);
            this.updateDisplay(config);
        });

        this.uiHandler.on('snapping-toggled', (event) => {
            this.snapping = event.enabled;
            this.labelDrawingCanvas.updateSnappingMode(event.enabled);
        });
    }

    /**
     * Setup resize and layout change handling
     */
    private setupResizeHandling(): void {
        // Handle window resize and layout changes
        const onResize = () => {
            this.renderer.resize();
            this.labelDrawingCanvas.resizeCanvas();
        };
        window.addEventListener('resize', onResize);

        // Listen for layout changes (when panels are toggled)
        this.resizeObserver = new ResizeObserver(() => {
            // Use immediate resize for responsive feel
            this.renderer.resize();
            this.labelDrawingCanvas.resizeCanvas();

            // Debounce additional resizes for performance
            if (this.resizeTimeout) {
                clearTimeout(this.resizeTimeout);
            }
            this.resizeTimeout = window.setTimeout(() => {
                this.renderer.resize();
                this.labelDrawingCanvas.resizeCanvas();
            }, 50); // Much shorter delay
        });
        this.resizeObserver.observe(this.container);

        // Listen for explicit layout change events from panel toggles
        this.layoutChangeHandler = () => {
            // Immediate resize for responsive feedback
            this.renderer.resize();
            this.labelDrawingCanvas.resizeCanvas();

            // Additional resize after layout transition
            if (this.resizeTimeout) {
                clearTimeout(this.resizeTimeout);
            }
            this.resizeTimeout = window.setTimeout(() => {
                this.renderer.resize();
                this.labelDrawingCanvas.resizeCanvas();
            }, 220); // Match CSS transition duration + small buffer
        };
        window.addEventListener('timelab:layoutChanged', this.layoutChangeHandler);
    }

    /**
     * Update UI elements when series changes
     */
    private updateUIFromSeriesChange(): void {
        const info = this.getCurrentSeriesInfo();
        this.uiHandler.updateSeriesIndicator(info.index, info.total);
        this.uiHandler.updateSeriesNavigationButtons(info.total);
        this.uiHandler.updateLabeledButton(info.labeled);
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

        // Update UI handler with latest series info
        this.updateUIFromSeriesChange();

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

        // Series navigation container visibility
        const seriesNavigation = document.querySelector(
            '.right[role="group"][aria-label="Series navigation"]'
        );
        if (seriesNavigation instanceof HTMLElement) {
            seriesNavigation.style.display = hasData ? '' : 'none';
            seriesNavigation.setAttribute('aria-hidden', hasData ? 'false' : 'true');

            // Update tabindex for all buttons within the series navigation
            const navButtons = seriesNavigation.querySelectorAll('button');
            navButtons.forEach((button) => {
                button.tabIndex = hasData ? 0 : -1;
            });
        }
    }

    /**
     * Get current data source
     */
    getCurrentSource(): TimeSeriesData | null {
        return this.dataSources[this.currentIndex] || null;
    }

    /**
     * Get data source by index
     */
    getDataSourceByIndex(index: number): TimeSeriesData | null {
        return this.dataSources[index] || null;
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

        // Update UI handler with latest series info
        this.updateUIFromSeriesChange();
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

        // Update UI handler with latest series info
        this.updateUIFromSeriesChange();
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
            this.uiHandler.updateLabeledButton(newState);
            this.emit('label-changed', { index: this.currentIndex, labeled: newState });
        }
    }

    /**
     * Enable or disable label drawing mode
     */
    setLabelMode(enabled: boolean, labelDefId?: string): void {
        this.labelMode = enabled;
        this.currentLabelDefId = labelDefId || null;

        // Configure drawing canvas component
        const currentSource = this.getCurrentSource();
        this.labelDrawingCanvas.configure({
            enabled,
            currentLabelDefId: this.currentLabelDefId,
            datasetId: currentSource?.id || '',
            snapping: this.snapping,
        });

        this.emit('label-mode-changed', { enabled });
    }

    /**
     * Update the current label definition (when switching active label while in label mode)
     */
    setCurrentLabelDefinition(labelDefId: string | null): void {
        this.currentLabelDefId = labelDefId;

        // Update the drawing canvas with the new label definition if label mode is enabled
        if (this.labelMode) {
            const currentSource = this.getCurrentSource();
            this.labelDrawingCanvas.configure({
                enabled: this.labelMode,
                currentLabelDefId: this.currentLabelDefId,
                datasetId: currentSource?.id || '',
                snapping: this.snapping,
            });
        }
    }

    /**
     * Check if label mode is currently enabled
     */
    isLabelModeEnabled(): boolean {
        return this.labelMode;
    }

    /**
     * Highlight a specific label on the chart
     */
    highlightLabel(labelId: string | null): void {
        this.renderer.setHighlightedLabel(labelId);

        // Refresh the chart to apply highlighting
        const lastConfig = this.configManager.getLastConfig();
        if (lastConfig) {
            this.updateDisplay(lastConfig);
        }
    }

    /**
     * Clear any label highlighting
     */
    clearLabelHighlight(): void {
        this.highlightLabel(null);
    }

    /**
     * Toggle visibility of a specific label
     */
    toggleLabelVisibility(labelId: string): void {
        const source = this.getCurrentSource();
        if (!source) return;

        source.toggleLabelVisibility(labelId);

        // Refresh display to show updated labels
        const lastConfig = this.configManager.getLastConfig();
        if (lastConfig) {
            this.updateDisplay(lastConfig);
        }
    }

    /**
     * Update chart display with current configuration
     */
    updateDisplay(config: TimeSeriesConfig): void {
        // Store the configuration
        this.configManager.setLastConfig(config);

        const source = this.getCurrentSource();

        // If no data sources at all, always show empty state
        if (this.dataSources.length === 0) {
            this.renderer.clearDisplay();
            this.updateEmptyState(true);
            return;
        }

        if (!source || !this.chart) {
            this.renderer.clearDisplay();
            this.updateEmptyState(true);
            return;
        }

        const data = source.getData(config.xColumn, config.yColumn);

        // Process data using configuration manager
        const seriesData = this.configManager.processSeriesData(data, config);

        // Build axis and series configurations
        const { xAxis, yAxis, tooltip } = this.configManager.buildAxisConfiguration(config);
        const seriesConfig = this.configManager.buildSeriesConfiguration(config);

        // Render chart using renderer component
        this.renderer.updateDisplay(
            config,
            seriesData,
            xAxis,
            yAxis,
            tooltip,
            seriesConfig,
            source
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
     * Get the last used configuration
     */
    getLastConfig(): TimeSeriesConfig | null {
        return this.configManager.getLastConfig();
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
        if (this.timeSeriesLabelsChangedHandler) {
            window.removeEventListener(
                'timelab:timeSeriesLabelsChanged',
                this.timeSeriesLabelsChangedHandler
            );
            this.timeSeriesLabelsChangedHandler = null;
        }
        if (this.labelDefinitionsLoadedHandler) {
            window.removeEventListener(
                'timelab:labelDefinitionsLoaded',
                this.labelDefinitionsLoadedHandler
            );
            this.labelDefinitionsLoadedHandler = null;
        }
        if (this.labelModeForceDisabledHandler) {
            window.removeEventListener(
                'timelab:labelModeForceDisabled',
                this.labelModeForceDisabledHandler
            );
            this.labelModeForceDisabledHandler = null;
        }
        if (this.chart) {
            this.chart.dispose();
            this.chart = null;
        }
        if (this.emptyStateElement) {
            this.emptyStateElement.remove();
            this.emptyStateElement = null;
        }

        // Clean up all components
        this.labelDrawingCanvas.dispose();
        this.configManager.dispose();
        this.renderer.dispose();
        this.uiHandler.dispose();
    }
}

/**
 * Data manager interface for handling uploads and storage
 */
export interface DataManager {
    /**
     * Get all available data sources
     */
    getDataSources(): Promise<Result<readonly TimeSeriesData[]>>;

    /**
     * Subscribe to data changes
     */
    onDataChanged(callback: (sources: readonly TimeSeriesData[]) => void): void;

    /**
     * Remove data change subscription
     */
    offDataChanged(callback: (sources: readonly TimeSeriesData[]) => void): void;
}

/**
 * Initialize chart with clean empty state using the new component architecture
 */
export function initializeTimeSeriesChart(): TimeSeriesChart {
    const container = document.getElementById('chart-canvas');
    if (!container) {
        throw new Error('Chart container #chart-canvas not found');
    }

    const chart = new TimeSeriesChart(container);

    // Set up event listeners for UI updates
    chart.on('series-changed', () => {
        // UI updates are now handled by the UIEventHandler component
        // These events are mainly for external consumers
    });

    chart.on('label-changed', () => {
        // UI updates are now handled by the UIEventHandler component
    });

    chart.on('columns-available', (event) => {
        // Trigger the event for the dropdown system to handle
        const customEvent = new CustomEvent('timelab:columnsAvailable', {
            detail: { columns: Array.from(event.columns) },
        });
        window.dispatchEvent(customEvent);
    });

    // Initialize with empty state
    chart.setDataSources([]);

    return chart;
}
