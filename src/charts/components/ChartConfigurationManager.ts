import type { TimeSeriesConfig } from '../timeSeries';
import type { SafeTooltipConfig } from '../types';

/**
 * Events emitted by the chart configuration manager
 */
export interface ChartConfigEvents {
    'config-changed': { config: TimeSeriesConfig };
}

/**
 * Manages chart configuration and UI control binding.
 * Handles reading configuration from UI elements and providing chart options.
 */
export class ChartConfigurationManager {
    private listeners = new Map<keyof ChartConfigEvents, Array<(event: unknown) => void>>();
    private lastConfig: TimeSeriesConfig | null = null;
    private cleanupFunctions: Array<() => void> = [];

    /**
     * Initialize configuration manager and bind to UI controls
     */
    constructor() {
        this.bindConfigurationControls();
    }

    /**
     * Add event listener
     */
    on<K extends keyof ChartConfigEvents>(
        event: K,
        listener: (data: ChartConfigEvents[K]) => void
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
    off<K extends keyof ChartConfigEvents>(
        event: K,
        listener: (data: ChartConfigEvents[K]) => void
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
    private emit<K extends keyof ChartConfigEvents>(event: K, data: ChartConfigEvents[K]): void {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            eventListeners.forEach((listener) => {
                listener(data);
            });
        }
    }

    /**
     * Get current chart configuration from UI controls
     */
    getCurrentConfig(xColumn: string, yColumn: string): TimeSeriesConfig {
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

        // Helper to get xType value - default to numeric for all columns
        const xTypeValue = elXType ? (elXType as { value?: string }).value : undefined;

        const xType: 'category' | 'time' | 'value' = (() => {
            // Respect user's explicit choice
            switch (xTypeValue) {
                case 'time':
                    return 'time';
                case 'numeric':
                    return 'value';
                case 'index':
                    return 'category';
            }

            // Special case: when user selects "index" column, treat as category
            if (xColumn === 'index') {
                return 'category';
            }

            // Default: all data columns are numeric (value axis)
            return 'value';
        })();

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

        this.lastConfig = { ...config };
        return config;
    }

    /**
     * Get the last used configuration
     */
    getLastConfig(): TimeSeriesConfig | null {
        return this.lastConfig;
    }

    /**
     * Update stored configuration (for external updates)
     */
    setLastConfig(config: TimeSeriesConfig): void {
        this.lastConfig = { ...config };
    }

    /**
     * Bind event listeners to all configuration controls
     */
    private bindConfigurationControls(): void {
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
            if (this.lastConfig) {
                const config = this.getCurrentConfig(
                    this.lastConfig.xColumn,
                    this.lastConfig.yColumn
                );
                this.emit('config-changed', { config });
            }
        };

        configElements.forEach((selector) => {
            const element = document.querySelector(selector);
            if (element) {
                const changeHandler = () => {
                    onConfigChange();
                };
                const inputHandler = () => {
                    onConfigChange();
                };

                element.addEventListener('change', changeHandler);
                element.addEventListener('input', inputHandler);

                // Store cleanup function
                this.cleanupFunctions.push(() => {
                    element.removeEventListener('change', changeHandler);
                    element.removeEventListener('input', inputHandler);
                });
            }
        });

        // Listen for automatic axis option updates
        const axisUpdateHandler = (event: Event) => {
            const customEvent = event as CustomEvent<{ xColumn: string; yColumn: string }>;
            const { xColumn, yColumn } = customEvent.detail;
            if (xColumn && yColumn) {
                const config = this.getCurrentConfig(xColumn, yColumn);
                this.emit('config-changed', { config });
            }
        };

        window.addEventListener('timelab:axisOptionsUpdated', axisUpdateHandler);
        this.cleanupFunctions.push(() => {
            window.removeEventListener('timelab:axisOptionsUpdated', axisUpdateHandler);
        });
    }

    /**
     * Process series data based on configuration
     */
    processSeriesData(
        data: ReadonlyArray<readonly [number, number]>,
        config: TimeSeriesConfig
    ): ReadonlyArray<readonly [number | string, number]> {
        // Process data based on x-axis column selection
        let seriesData: ReadonlyArray<readonly [number | string, number]> = data;
        if (config.xType === 'category' && config.xColumn === 'index') {
            // Only use row indices when specifically "index" is selected
            seriesData = data.map((_pair, i) => [String(i), data[i]?.[1] ?? NaN] as const);
        } else {
            // Use the actual data from getData method for all other columns
            seriesData = data;
        }

        return seriesData;
    }

    /**
     * Build axis configuration from chart config
     */
    buildAxisConfiguration(config: TimeSeriesConfig): {
        xAxis: any;
        yAxis: any;
        tooltip: SafeTooltipConfig;
    } {
        const showGrid = config.showGridlines ?? true;
        const tooltipMode = config.tooltipMode ?? 'axis';
        const snap = config.snap ?? false;
        const yAuto = config.yAuto ?? true;

        // Configure axes with proper auto-scaling
        const xAxis: any = {
            type: this.toSafeAxisType(config.xType || 'category'),
            boundaryGap: config.xType === 'category',
            axisLine: showGrid ? {} : { show: false },
            splitLine: { show: showGrid },
            scale: true, // Enable auto-scaling for X axis
            axisLabel: {
                // Format X-axis labels to avoid excessive decimal places
                formatter: (value: number | string) => {
                    if (typeof value === 'number') {
                        // Round to at most 3 decimal places and remove trailing zeros
                        return parseFloat(value.toFixed(3)).toString();
                    }
                    return value;
                },
            },
        };

        const yAxis: any = {
            type: this.toSafeAxisType(config.yType || 'value'),
            scale: true, // Always enable auto-scaling for Y axis
            axisLine: showGrid ? {} : { show: false },
            splitLine: { show: showGrid },
            axisLabel: {
                // Format Y-axis labels to avoid excessive decimal places
                formatter: (value: number) => {
                    // Round to at most 3 decimal places and remove trailing zeros
                    return parseFloat(value.toFixed(3)).toString();
                },
            },
        };

        // Apply manual Y-axis range if not auto (override the scale setting)
        if (!yAuto) {
            yAxis.scale = false; // Disable auto-scaling when manual range is set
            if (config.yMin !== undefined) {
                yAxis.min = config.yMin;
            }
            if (config.yMax !== undefined) {
                yAxis.max = config.yMax;
            }
        }

        // Configure tooltip
        const tooltip: SafeTooltipConfig =
            tooltipMode === 'none'
                ? { show: false }
                : {
                      trigger: this.toSafeTooltipTrigger(tooltipMode),
                      axisPointer: { type: 'cross' as const, snap },
                  };

        return { xAxis, yAxis, tooltip };
    }

    /**
     * Build series configuration from chart config
     */
    buildSeriesConfiguration(config: TimeSeriesConfig, markLine?: any, markArea?: any): any {
        const smooth = config.smooth ?? true;
        const showArea = config.showArea ?? false;
        const showSymbol = config.showPoints ?? false;
        const lineWidth = config.lineWidth ?? 2;
        const sampling = config.sampling;

        return {
            type: 'line',
            name: 'Signal',
            smooth,
            showSymbol,
            sampling,
            lineStyle: { width: lineWidth },
            areaStyle: showArea ? { opacity: 0.3 } : undefined,
            markLine,
            markArea,
        };
    }

    /**
     * Safe conversion to axis type (imported functionality)
     */
    private toSafeAxisType(type: string): 'category' | 'value' | 'time' | 'log' {
        switch (type) {
            case 'category':
                return 'category';
            case 'time':
                return 'time';
            case 'log':
                return 'log';
            default:
                return 'value';
        }
    }

    /**
     * Safe conversion to tooltip trigger (imported functionality)
     */
    private toSafeTooltipTrigger(mode: string): 'axis' | 'item' | 'none' {
        switch (mode) {
            case 'axis':
                return 'axis';
            case 'item':
                return 'item';
            case 'none':
                return 'none';
            default:
                return 'axis';
        }
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
