import { getLabelDefinitions } from '../../ui/dropdowns';
import type { ECharts } from '../echarts';
import type { TimeSeriesConfig, TimeSeriesData } from '../timeSeries';
import { createThresholdMarkLine } from '../types';

/**
 * Events emitted by the chart renderer
 */
export interface ChartRendererEvents {
    'zoom-changed': { start?: number; end?: number };
}

/**
 * Manages chart rendering and display updates.
 * Handles data visualization, labels, thresholds, and zoom interactions.
 */
export class ChartRenderer {
    private chart: ECharts | null = null;
    private listeners = new Map<keyof ChartRendererEvents, Array<(event: unknown) => void>>();
    private currentData: ReadonlyArray<readonly [number | string, number]> = [];
    private highlightedLabelId: string | null = null;

    /**
     * Initialize chart renderer
     */

    /**
     * Initialize with chart instance
     */
    initialize(chart: ECharts): void {
        this.chart = chart;
        this.setupZoomListener();
    }

    /**
     * Add event listener
     */
    on<K extends keyof ChartRendererEvents>(
        event: K,
        listener: (data: ChartRendererEvents[K]) => void
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
    off<K extends keyof ChartRendererEvents>(
        event: K,
        listener: (data: ChartRendererEvents[K]) => void
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
    private emit<K extends keyof ChartRendererEvents>(
        event: K,
        data: ChartRendererEvents[K]
    ): void {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            eventListeners.forEach((listener) => {
                listener(data);
            });
        }
    }

    /**
     * Set highlighted label ID
     */
    setHighlightedLabel(labelId: string | null): void {
        this.highlightedLabelId = labelId;
    }

    /**
     * Update chart display with configuration and data
     */
    updateDisplay(
        config: TimeSeriesConfig,
        seriesData: ReadonlyArray<readonly [number | string, number]>,
        xAxis: any,
        yAxis: any,
        tooltip: any,
        seriesConfig: any,
        source: TimeSeriesData | null
    ): void {
        if (!this.chart) return;

        this.currentData = seriesData;

        // Configure threshold line
        let markLine: any;
        if (config.thresholdEnabled && config.thresholdValue !== undefined) {
            markLine = createThresholdMarkLine(config.thresholdValue);
        }

        // Configure label areas
        const markArea = this.buildLabelMarkAreas(source);

        // Update chart with complete configuration
        this.chart.setOption(
            {
                tooltip,
                xAxis,
                yAxis,
                series: [
                    {
                        ...seriesConfig,
                        markLine,
                        markArea,
                        data: [...seriesData] as Array<[number | string, number]>,
                    },
                ],
            },
            false,
            true
        );

        // Update Y-axis for auto-scaling
        this.updateYAxisFromZoom();
    }

    /**
     * Update Y-axis range based on zoom level (for auto-scaling)
     */
    updateYAxisFromZoom(start?: number, end?: number): void {
        if (!this.chart || this.currentData.length === 0) {
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
     * Clear chart data (show empty series)
     */
    clearDisplay(): void {
        if (!this.chart) return;

        this.chart.setOption({ series: [{ data: [] }] });
        this.currentData = [];
    }

    /**
     * Resize chart
     */
    resize(): void {
        if (this.chart) {
            this.chart.resize();
        }
    }

    /**
     * Setup zoom event listener
     */
    private setupZoomListener(): void {
        if (!this.chart) return;

        const handleZoomEvent = (params: { start?: number; end?: number }): void => {
            this.updateYAxisFromZoom(params.start, params.end);
            this.emit('zoom-changed', params);
        };

        this.chart.on('dataZoom', handleZoomEvent);
    }

    /**
     * Build markArea configuration for displaying labels
     */
    private buildLabelMarkAreas(source: TimeSeriesData | null): any {
        if (!source) return undefined;

        const labels = source.getLabels();
        if (labels.length === 0) return undefined;

        // Filter to only show visible labels
        const visibleLabels = labels.filter((label) => label.visible !== false);
        if (visibleLabels.length === 0) return undefined;

        // Create markArea data for each visible label
        const markAreaData = visibleLabels.map((label) => {
            const isHighlighted = this.highlightedLabelId === label.id;
            const opacity = isHighlighted ? 0.6 : 0.3; // Higher opacity for highlighted labels
            const baseColor = this.getLabelColor(label.labelDefId, 1.0);

            return [
                {
                    xAxis: label.startTime,
                    itemStyle: {
                        color: this.getLabelColor(label.labelDefId, opacity),
                        borderColor: baseColor,
                        borderWidth: isHighlighted ? 2 : 1, // Always show borders, thicker when highlighted
                        borderType: 'solid',
                    },
                    label: {
                        show: false, // Hide label names on chart areas
                    },
                },
                {
                    xAxis: label.endTime,
                },
            ];
        });

        return {
            silent: true, // Don't intercept mouse events - allow drawing over labels
            data: markAreaData as never, // ECharts markArea expects complex nested array structure
        };
    }

    /**
     * Get display color for a label definition
     */
    private getLabelColor(labelDefId: string, opacity = 1): string {
        // Try to find the label definition by UUID
        const labelDefinitions = getLabelDefinitions();
        const definition = labelDefinitions.find((def) => def.id === labelDefId);

        if (definition && definition.color && typeof definition.color === 'string') {
            // Convert hex to rgba with opacity
            const hex = definition.color.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            return `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(opacity)})`;
        }

        // Fallback for legacy format "label-{index}" or hardcoded labels
        const match = labelDefId.match(/^label-(\d+)$/);
        if (match && match[1]) {
            const index = parseInt(match[1], 10);
            const definition = labelDefinitions[index];
            if (definition && definition.color && typeof definition.color === 'string') {
                // Convert hex to rgba with opacity
                const hex = definition.color.replace('#', '');
                const r = parseInt(hex.substring(0, 2), 16);
                const g = parseInt(hex.substring(2, 4), 16);
                const b = parseInt(hex.substring(4, 6), 16);
                return `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(opacity)})`;
            }
        }

        // Fallback for hardcoded labels or invalid IDs
        const colors: Record<string, string> = {
            'default-positive': '#28a745',
            'default-negative': '#dc3545',
            'default-neutral': '#6c757d',
        };

        const baseColor = colors[labelDefId] || '#007bff';

        // Convert hex to rgba with opacity
        const hex = baseColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        return `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(opacity)})`;
    }

    /**
     * Clean up resources
     */
    dispose(): void {
        this.listeners.clear();
    }
}
