import type { TimeSeriesLabel } from '../domain/labels';
import type { Result } from '../shared/result';
import type { EChartsExtended, ZRenderMouseEvent } from '../types/echarts-extensions';
import { installModalFocusTrap, closeModal } from '../ui/dom';
import { getLabelDefinitions } from '../ui/dropdowns';

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

    // Label drawing state
    private labelMode = false;
    private isDrawing = false;
    private drawStartX: number | null = null;
    private currentLabelDefId: string | null = null;
    private drawingCanvas: HTMLCanvasElement | null = null; // Canvas overlay for real-time drawing

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
                this.resizeDrawingCanvas(); // Resize canvas overlay too
            }
        };
        window.addEventListener('resize', onResize);

        // Listen for layout changes (when panels are toggled)
        this.resizeObserver = new ResizeObserver(() => {
            // Use immediate resize for responsive feel
            if (this.chart) {
                this.chart.resize();
                this.resizeDrawingCanvas();
            }
            // Debounce additional resizes for performance
            if (this.resizeTimeout) {
                clearTimeout(this.resizeTimeout);
            }
            this.resizeTimeout = window.setTimeout(() => {
                if (this.chart) {
                    this.chart.resize();
                    this.resizeDrawingCanvas();
                }
            }, 50); // Much shorter delay
        });
        this.resizeObserver.observe(container);

        // Listen for explicit layout change events from panel toggles
        this.layoutChangeHandler = () => {
            // Immediate resize for responsive feedback
            if (this.chart) {
                this.chart.resize();
                this.resizeDrawingCanvas();
            }
            // Additional resize after layout transition
            if (this.resizeTimeout) {
                clearTimeout(this.resizeTimeout);
            }
            this.resizeTimeout = window.setTimeout(() => {
                if (this.chart) {
                    this.chart.resize();
                    this.resizeDrawingCanvas();
                }
            }, 220); // Match CSS transition duration + small buffer
        };
        window.addEventListener('timelab:layoutChanged', this.layoutChangeHandler);

        // Listen for time series label changes (from label definition updates/deletions)
        window.addEventListener('timelab:timeSeriesLabelsChanged', () => {
            // Refresh the chart to show updated/removed labels
            if (this.lastConfig) {
                this.updateDisplay(this.lastConfig);
            }
        });
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
     * Enable or disable label drawing mode
     */
    setLabelMode(enabled: boolean, labelDefId?: string): void {
        this.labelMode = enabled;
        this.currentLabelDefId = labelDefId || null;

        if (this.chart) {
            if (enabled) {
                this.enableLabelDrawing();
            } else {
                this.disableLabelDrawing();
            }
        }

        this.emit('label-mode-changed', { enabled });
    }

    /**
     * Update the current label definition (when switching active label while in label mode)
     */
    setCurrentLabelDefinition(labelDefId: string | null): void {
        this.currentLabelDefId = labelDefId;
    }

    /**
     * Check if label mode is currently enabled
     */
    isLabelModeEnabled(): boolean {
        return this.labelMode;
    }

    // Label highlighting state
    private highlightedLabelId: string | null = null;

    /**
     * Highlight a specific label on the chart
     */
    highlightLabel(labelId: string | null): void {
        this.highlightedLabelId = labelId;

        // Refresh the chart to apply highlighting
        if (this.lastConfig) {
            this.updateDisplay(this.lastConfig);
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
        if (this.lastConfig) {
            this.updateDisplay(this.lastConfig);
        }
    }

    /**
     * Enable interactive label drawing
     */
    private enableLabelDrawing(): void {
        if (!this.chart) return;

        // Disable default interactions (zoom/pan) and tooltip/crosshair completely
        this.chart.setOption({
            dataZoom: [{ disabled: true }, { disabled: true }],
            tooltip: {
                show: false, // Completely hide tooltip
            },
            axisPointer: {
                show: false, // Disable axis pointer globally
            },
        });

        // Setup canvas overlay for real-time drawing
        this.setupDrawingCanvas();

        // Setup drawing event listeners
        this.setupLabelDrawingEvents();
    }

    /**
     * Setup canvas overlay for real-time drawing feedback
     */
    private setupDrawingCanvas(): void {
        if (!this.chart) return;

        const chartContainer = this.chart.getDom();
        if (!chartContainer) return;

        // Create canvas overlay
        this.drawingCanvas = document.createElement('canvas');
        this.drawingCanvas.style.position = 'absolute';
        this.drawingCanvas.style.top = '0';
        this.drawingCanvas.style.left = '0';
        this.drawingCanvas.style.pointerEvents = 'none'; // Allow mouse events to pass through
        this.drawingCanvas.style.zIndex = '1000';

        // Size the canvas to match the chart
        this.resizeDrawingCanvas();

        // Add to container
        chartContainer.style.position = 'relative';
        chartContainer.appendChild(this.drawingCanvas);
    }

    /**
     * Resize the drawing canvas to match the chart container
     */
    private resizeDrawingCanvas(): void {
        if (!this.chart || !this.drawingCanvas) return;

        const chartContainer = this.chart.getDom();
        if (!chartContainer) return;

        const containerRect = chartContainer.getBoundingClientRect();
        this.drawingCanvas.width = containerRect.width;
        this.drawingCanvas.height = containerRect.height;
    }

    /**
     * Disable interactive label drawing and restore default interactions
     */
    private disableLabelDrawing(): void {
        if (!this.chart) return;

        // Re-enable default interactions and restore tooltip/crosshair
        this.chart.setOption({
            dataZoom: [{ disabled: false }, { disabled: false }],
            tooltip: {
                show: true, // Re-enable tooltip
                trigger: 'axis',
                axisPointer: { type: 'cross' }, // Restore crosshair
            },
            axisPointer: {
                show: true, // Re-enable axis pointer globally
            },
        });

        // Remove drawing graphics
        this.clearDrawingGraphics();

        // Clean up canvas overlay
        this.cleanupDrawingCanvas();

        // Reset drawing state
        this.isDrawing = false;
        this.drawStartX = null;
        this.clearDrawingGraphics();
    }

    /**
     * Clean up the drawing canvas overlay
     */
    private cleanupDrawingCanvas(): void {
        if (this.drawingCanvas && this.drawingCanvas.parentElement) {
            this.drawingCanvas.parentElement.removeChild(this.drawingCanvas);
            this.drawingCanvas = null;
        }
    }

    /**
     * Setup event listeners for label drawing
     */
    private setupLabelDrawingEvents(): void {
        if (!this.chart) return;

        // Listen to mouse events for drawing
        const extendedChart = this.chart as EChartsExtended;
        extendedChart.getZr().on('mousedown', this.handleDrawingMouseDown.bind(this));
        extendedChart.getZr().on('mousemove', this.handleDrawingMouseMove.bind(this));
        extendedChart.getZr().on('mouseup', this.handleDrawingMouseUp.bind(this));
    }

    /**
     * Handle mouse down for label drawing
     */
    private handleDrawingMouseDown(event: ZRenderMouseEvent): void {
        if (!this.chart || !this.labelMode) return;

        // Allow drawing anywhere in the chart area
        // The event comes from the zrender canvas, so we can proceed
        const pixelPoint: [number, number] = [event.offsetX, event.offsetY];
        const extendedChart = this.chart as EChartsExtended;
        const dataPoint = extendedChart.convertFromPixel({ gridIndex: 0 }, pixelPoint);

        if (dataPoint && dataPoint[0] !== null) {
            this.isDrawing = true;
            this.drawStartX = dataPoint[0];
            // Show initial canvas line at the start position
            this.showCanvasPreviewLine(pixelPoint[0]);
        }
    }

    /**
     * Handle mouse move for label drawing
     */
    private handleDrawingMouseMove(event: ZRenderMouseEvent): void {
        if (!this.chart || !this.labelMode) return;

        const pixelPoint: [number, number] = [event.offsetX, event.offsetY];

        if (this.isDrawing && this.drawStartX !== null) {
            // Update drawing rectangle using canvas overlay for real-time feedback
            this.updateDrawingCanvasRectangle(pixelPoint);
        } else {
            // Show preview line when hovering using canvas
            if (typeof pixelPoint[0] === 'number') {
                this.showCanvasPreviewLine(pixelPoint[0]);
            }
        }
    }

    /**
     * Show a solid vertical line indicator using canvas
     */
    private showCanvasPreviewLine(pixelX: number): void {
        if (!this.chart || !this.drawingCanvas) return;

        const chartArea = this.getChartPlottingArea();
        if (!chartArea) return;

        const ctx = this.drawingCanvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, this.drawingCanvas.width, this.drawingCanvas.height);

        // Convert pixel position to data position and snap to nearest data point
        const extendedChart = this.chart as EChartsExtended;
        const dataPoint = extendedChart.convertFromPixel({ gridIndex: 0 }, [pixelX, chartArea.y]);
        if (!dataPoint || dataPoint[0] === null) return;

        // Convert snapped data position back to pixel for precise drawing
        const snappedPixel = extendedChart.convertToPixel({ gridIndex: 0 }, [dataPoint[0], 0]);
        if (!snappedPixel || typeof snappedPixel[0] !== 'number') return;

        const snappedX = snappedPixel[0];

        // Get the color for the current label definition (solid, no transparency)
        const lineColor = this.currentLabelDefId
            ? this.getLabelColor(this.currentLabelDefId, 1.0)
            : '#007bff';

        // Draw solid vertical line at snapped position
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 2;
        ctx.setLineDash([]); // Solid line, no dashes

        ctx.beginPath();
        ctx.moveTo(snappedX, chartArea.y);
        ctx.lineTo(snappedX, chartArea.y + chartArea.height);
        ctx.stroke();
    }

    /**
     * Update the drawing rectangle on canvas overlay (real-time)
     */
    private updateDrawingCanvasRectangle(pixelPoint: [number, number]): void {
        if (!this.chart || !this.drawingCanvas || this.drawStartX === null) return;

        // Get snapped pixel coordinates for both start and current positions
        const extendedChart = this.chart as EChartsExtended;
        const startPixel = extendedChart.convertToPixel({ gridIndex: 0 }, [this.drawStartX, 0]);

        // Snap the current position to data points too
        const currentDataPoint = extendedChart.convertFromPixel({ gridIndex: 0 }, pixelPoint);
        if (!currentDataPoint || currentDataPoint[0] === null) return;

        const currentSnappedPixel = extendedChart.convertToPixel({ gridIndex: 0 }, [
            currentDataPoint[0],
            0,
        ]);

        // Get the actual chart plotting area (where data is displayed)
        const chartArea = this.getChartPlottingArea();

        if (
            !startPixel ||
            !currentSnappedPixel ||
            !chartArea ||
            typeof startPixel[0] !== 'number' ||
            typeof currentSnappedPixel[0] !== 'number'
        ) {
            return;
        }

        const ctx = this.drawingCanvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, this.drawingCanvas.width, this.drawingCanvas.height);

        const startX = startPixel[0];
        const currentX = currentSnappedPixel[0];
        const x = Math.min(startX, currentX);
        const width = Math.abs(currentX - startX);

        // Get colors for the current label definition
        const labelColor = this.currentLabelDefId
            ? this.getLabelColor(this.currentLabelDefId, 0.3)
            : 'rgba(0, 123, 255, 0.2)';
        const strokeColor = this.currentLabelDefId
            ? this.getLabelColor(this.currentLabelDefId, 1.0)
            : '#007bff';

        // Draw rectangle on canvas - use exact chart plotting area dimensions
        ctx.fillStyle = labelColor;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2;

        ctx.fillRect(x, chartArea.y, width, chartArea.height);
        ctx.strokeRect(x, chartArea.y, width, chartArea.height);
    }

    /**
     * Get the actual chart plotting area where data is displayed
     */
    private getChartPlottingArea(): { x: number; y: number; width: number; height: number } | null {
        if (!this.chart) return null;

        try {
            // Get container dimensions
            const container = this.chart.getDom();
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;

            // Use the actual grid configuration with minimal buffers for precision
            // grid: { left: 40, right: 16, top: 16, bottom: 65 }
            const left = 42; // Y-axis area + minimal buffer
            const top = 18; // Title/legend area + minimal buffer
            const right = 18; // Right margin + minimal buffer
            const bottom = 67; // X-axis + dataZoom area + minimal buffer

            // Calculate the actual plotting area
            const plottingWidth = containerWidth - left - right;
            const plottingHeight = containerHeight - top - bottom;

            return {
                x: Math.round(left),
                y: Math.round(top),
                width: Math.round(plottingWidth),
                height: Math.round(plottingHeight),
            };
        } catch (_error) {
            // Failed to get precise chart area, use fallback
        }

        // Conservative fallback using the same grid values
        const container = this.chart.getDom();
        const rect = container.getBoundingClientRect();

        return {
            x: 42, // Match updated left margin
            y: 18, // Match updated top margin
            width: rect.width - 60, // left + right = 42 + 18
            height: rect.height - 85, // top + bottom = 18 + 67
        };
    }

    /**
     * Handle mouse up to finalize label drawing
     */
    private handleDrawingMouseUp(event: ZRenderMouseEvent): void {
        if (!this.chart || !this.labelMode || !this.isDrawing || this.drawStartX === null) return;

        const pixelPoint: [number, number] = [event.offsetX, event.offsetY];
        const extendedChart = this.chart as EChartsExtended;
        const dataPoint = extendedChart.convertFromPixel({ gridIndex: 0 }, pixelPoint);

        if (dataPoint && dataPoint[0] !== null) {
            const endX = dataPoint[0];
            this.finalizeLabelDrawing(this.drawStartX, endX);
        }

        // Clear the drawing canvas
        if (this.drawingCanvas) {
            const ctx = this.drawingCanvas.getContext('2d');
            ctx?.clearRect(0, 0, this.drawingCanvas.width, this.drawingCanvas.height);
        }

        // Reset drawing state
        this.isDrawing = false;
        this.drawStartX = null;
        this.clearDrawingGraphics();
    }

    /**
     * Finalize the label drawing and create the label
     */
    private finalizeLabelDrawing(startX: number, endX: number): void {
        const source = this.getCurrentSource();
        if (!source || !this.currentLabelDefId) return;

        // Ensure proper order
        const actualStartX = Math.min(startX, endX);
        const actualEndX = Math.max(startX, endX);

        // Prevent creating labels that are too narrow (1 point wide or less)
        const labelWidth = Math.abs(actualEndX - actualStartX);
        const minLabelWidth = 1; // Minimum time difference to create a meaningful label

        if (labelWidth < minLabelWidth) {
            console.log('Label too narrow, minimum width required:', minLabelWidth);
            return; // Don't create the label
        }

        // Create the label
        try {
            const label: TimeSeriesLabel = {
                id: crypto.randomUUID(),
                startTime: actualStartX,
                endTime: actualEndX,
                labelDefId: this.currentLabelDefId,
                datasetId: source.id,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };

            // Add to data source
            source.addLabel(label);

            // Emit event
            this.emit('label-drawn', { label });

            // Refresh display to show the new label
            if (this.lastConfig) {
                this.updateDisplay(this.lastConfig);
            }
        } catch (error) {
            console.error('Failed to create label:', error);
        }
    }

    /**
     * Clear all drawing graphics
     */
    private clearDrawingGraphics(): void {
        if (!this.chart) return;

        this.chart.setOption({
            graphic: {
                elements: [
                    {
                        id: 'label-start-line',
                        $action: 'remove',
                    },
                    {
                        id: 'label-drawing-rect',
                        $action: 'remove',
                    },
                ],
            },
        });
    }

    /**
     * Build markArea configuration for displaying labels
     */
    private buildLabelMarkAreas(): EChartOption.SeriesLine['markArea'] | undefined {
        const source = this.getCurrentSource();
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
            data: markAreaData as any, // ECharts markArea type is complex, using any for data compatibility
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
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);
            return `rgba(${r}, ${g}, ${b}, ${opacity})`;
        }

        // Fallback for legacy format "label-{index}" or hardcoded labels
        const match = labelDefId.match(/^label-(\d+)$/);
        if (match && match[1]) {
            const index = parseInt(match[1], 10);
            const definition = labelDefinitions[index];
            if (definition && definition.color && typeof definition.color === 'string') {
                // Convert hex to rgba with opacity
                const hex = definition.color.replace('#', '');
                const r = parseInt(hex.substr(0, 2), 16);
                const g = parseInt(hex.substr(2, 2), 16);
                const b = parseInt(hex.substr(4, 2), 16);
                return `rgba(${r}, ${g}, ${b}, ${opacity})`;
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
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);

        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
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
        console.log('Retrieved data for columns:', {
            xColumn: config.xColumn,
            yColumn: config.yColumn,
            dataLength: data.length,
            firstFewPoints: data.slice(0, 3),
            lastFewPoints: data.slice(-3),
            sourceName: source.name,
            sourceColumns: source.columns,
        });

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

        // Process data based on x-axis column selection
        let seriesData: ReadonlyArray<readonly [number | string, number]> = data;
        if (xType === 'category' && config.xColumn === 'index') {
            // Only use row indices when specifically "index" is selected
            seriesData = data.map((_pair, i) => [String(i), data[i]?.[1] ?? NaN] as const);
        } else {
            // Use the actual data from getData method for all other columns
            seriesData = data;
        }

        // Validate data for any invalid values
        const invalidPoints = seriesData.filter((point) => {
            const [x, y] = point;
            const xNum = typeof x === 'string' ? parseFloat(x) : x;
            return !Number.isFinite(xNum) || !Number.isFinite(y);
        });

        // eslint-disable-next-line no-console
        console.log('Final series data for chart:', {
            xType,
            xColumn: config.xColumn,
            processingType:
                xType === 'category' && config.xColumn === 'index' ? 'row indices' : 'actual data',
            totalPoints: seriesData.length,
            invalidPoints: invalidPoints.length,
            invalidSample: invalidPoints.slice(0, 3),
            firstFewSeriesPoints: seriesData.slice(0, 3),
            lastFewSeriesPoints: seriesData.slice(-3),
        });

        // Configure axes with proper auto-scaling
        const xAxis: EChartOption.XAxis = {
            type: xType as EChartOption.XAxis['type'],
            boundaryGap: xType === 'category',
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

        const yAxis: EChartOption.YAxis = {
            type: yType as EChartOption.YAxis['type'],
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

        // Configure threshold line
        let markLine: EChartOption.SeriesLine['markLine'] | undefined;
        if (config.thresholdEnabled && config.thresholdValue !== undefined) {
            markLine = {
                data: [{ yAxis: config.thresholdValue }],
                lineStyle: { type: 'dashed' },
                symbol: 'none',
            } as unknown as EChartOption.SeriesLine['markLine'];
        }

        // Configure label areas
        const markArea = this.buildLabelMarkAreas();

        // Configure tooltip
        const tooltip =
            tooltipMode === 'none'
                ? { show: false }
                : {
                      trigger: tooltipMode as EChartOption.Tooltip['trigger'],
                      axisPointer: { type: 'cross' as const, snap },
                  };

        // eslint-disable-next-line no-console
        console.log('Chart configuration debug:', {
            showArea,
            xType,
            yType,
            seriesDataLength: seriesData.length,
            firstPoint: seriesData[0],
            lastPoint: seriesData[seriesData.length - 1],
        });

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
                        areaStyle: showArea ? { opacity: 0.3 } : undefined,
                        markLine,
                        markArea,
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

    // Helper to get xType value - default to numeric for all columns
    const xTypeValue = elXType ? (elXType as { value?: string }).value : undefined;

    // eslint-disable-next-line no-console
    console.log('X-axis type detection:', {
        xColumn,
        xTypeDropdownValue: xTypeValue,
        elXType: elXType?.id,
    });

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

    // eslint-disable-next-line no-console
    console.log('X-axis type result:', xType);

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
    const btnLabelMode = document.getElementById('btn-label-mode') as HTMLButtonElement | null;

    elPrev?.addEventListener('click', () => {
        chart.previousSeries();
    });
    elNext?.addEventListener('click', () => {
        chart.nextSeries();
    });
    btnToggleLabeled?.addEventListener('click', () => {
        chart.toggleLabeled();
    });

    // Label mode toggle
    btnLabelMode?.addEventListener('click', () => {
        const isEnabled = chart.isLabelModeEnabled();
        const newState = !isEnabled;

        // Update button state
        btnLabelMode.setAttribute('aria-pressed', newState.toString());
        btnLabelMode.classList.toggle('active', newState);

        if (newState) {
            // Get selected label from active-label dropdown
            const activeLabelDropdown = document.querySelector<any>('#active-label');
            const selectedLabelValue = activeLabelDropdown?.value || null;

            if (!selectedLabelValue || selectedLabelValue === '') {
                // No label selected, show error or create default
                console.warn('No active label selected for drawing mode');
                // Revert button state
                btnLabelMode.setAttribute('aria-pressed', 'false');
                btnLabelMode.classList.remove('active');
                return;
            }

            // Enable label mode with selected label definition
            chart.setLabelMode(true, selectedLabelValue);
        } else {
            // Disable label mode
            chart.setLabelMode(false);
        }
    });

    // Listen for changes to the active label dropdown
    const activeLabelDropdown = document.querySelector('#active-label');
    if (activeLabelDropdown) {
        activeLabelDropdown.addEventListener('change', () => {
            // If label mode is currently enabled, update the current label definition
            if (chart.isLabelModeEnabled()) {
                const selectedLabelValue = (activeLabelDropdown as HTMLSelectElement).value || null;
                chart.setCurrentLabelDefinition(selectedLabelValue);
            }
        });
    }

    // Bind axis dropdown changes
    const xDropdown = document.querySelector('#x-axis');
    const yDropdown = document.querySelector('#y-axis');

    // eslint-disable-next-line no-console
    console.log('Dropdown element references:', {
        xDropdown: xDropdown?.id,
        yDropdown: yDropdown?.id,
        sameElement: xDropdown === yDropdown,
        xValue: (xDropdown as { value?: string } | null)?.value,
        yValue: (yDropdown as { value?: string } | null)?.value,
    });

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

        const xColumn = (xDropdown as { value?: string } | null)?.value || 'index';
        const yColumn = (yDropdown as { value?: string } | null)?.value || 'value';

        console.log('updateChart called with:', { xColumn, yColumn });

        // Only update if we have valid column values
        if (xColumn && yColumn && xColumn !== '' && yColumn !== '') {
            // Get current configuration from all UI controls
            const config = getCurrentChartConfig(xColumn, yColumn);
            console.log('Generated config:', {
                xColumn: config.xColumn,
                yColumn: config.yColumn,
                xType: config.xType,
            });
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

    xDropdown?.addEventListener('change', () => {
        console.log('X dropdown changed to:', (xDropdown as { value?: string } | null)?.value);
        updateChart();
    });
    yDropdown?.addEventListener('change', () => {
        console.log('Y dropdown changed to:', (yDropdown as { value?: string } | null)?.value);
        updateChart();
    });

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
        if (target.closest('[data-close]') || target === modal) {
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

    closeModal(modal);
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

        // Check if this series is labeled
        const dataSource = chart.getDataSourceByIndex(i);
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
