import type { TimeSeriesLabel } from '../../domain/labels';
import type { EChartsExtended, ZRenderMouseEvent } from '../../types/echarts-extensions';
import { getLabelDefinitions } from '../../ui/dropdowns';
import type { ECharts } from '../echarts';

/**
 * Events emitted by the label drawing canvas
 */
export interface LabelDrawingEvents {
    'label-drawn': { label: TimeSeriesLabel };
}

/**
 * Configuration for label drawing canvas
 */
export interface LabelDrawingConfig {
    enabled: boolean;
    currentLabelDefId: string | null;
    datasetId: string;
    snapping: boolean;
}

/**
 * Manages the interactive label drawing canvas overlay for the time series chart.
 * Handles real-time drawing feedback, mouse interactions, and label creation.
 */
export class LabelDrawingCanvas {
    private chart: ECharts | null = null;
    private drawingCanvas: HTMLCanvasElement | null = null;
    private listeners = new Map<keyof LabelDrawingEvents, Array<(event: unknown) => void>>();

    // Drawing state
    private enabled = false;
    private currentLabelDefId: string | null = null;
    private datasetId: string | null = null;
    private isDrawing = false;
    private drawStartX: number | null = null;
    private snapping = true; // Default to enabled

    /**
     * Initialize the label drawing canvas
     */

    /**
     * Initialize with chart instance
     */
    initialize(chart: ECharts): void {
        this.chart = chart;
    }

    /**
     * Configure the drawing canvas
     */
    configure(config: LabelDrawingConfig): void {
        const wasEnabled = this.enabled;
        this.enabled = config.enabled;
        this.currentLabelDefId = config.currentLabelDefId;
        this.datasetId = config.datasetId;
        this.snapping = config.snapping;

        if (!this.chart) return;

        if (config.enabled && !wasEnabled) {
            this.enableDrawing();
        } else if (!config.enabled && wasEnabled) {
            this.disableDrawing();
        }
    }

    /**
     * Update snapping mode for preview line
     */
    updateSnappingMode(enabled: boolean): void {
        this.snapping = enabled;
    }

    /**
     * Find the closest data point X coordinate to a given pixel X position
     */
    private findClosestDataPointX(pixelX: number): number | null {
        if (!this.chart) return null;

        const chartOption = this.chart.getOption();
        const series = chartOption.series as Array<{ data: Array<[number, number]> }>;

        if (series && series[0] && series[0].data && Array.isArray(series[0].data)) {
            const seriesData = series[0].data;
            const extendedChart = this.chart as EChartsExtended;

            // Convert current pixel to approximate data coordinate
            const chartArea = this.getChartPlottingArea();
            if (!chartArea) return null;

            const dataPoint = extendedChart.convertFromPixel({ gridIndex: 0 }, [
                pixelX,
                chartArea.y,
            ]);

            if (dataPoint && typeof dataPoint[0] === 'number') {
                const targetX = dataPoint[0];

                // Find the closest data point
                let closestPoint = seriesData[0];
                let minDistance = Math.abs((seriesData[0]?.[0] ?? 0) - targetX);

                for (let i = 1; i < seriesData.length; i++) {
                    const currentPoint = seriesData[i];
                    if (currentPoint && typeof currentPoint[0] === 'number') {
                        const distance = Math.abs(currentPoint[0] - targetX);
                        if (distance < minDistance) {
                            minDistance = distance;
                            closestPoint = currentPoint;
                        }
                    }
                }

                return closestPoint?.[0] ?? null;
            }
        }

        return null;
    }

    /**
     * Fallback method to convert pixel to data coordinate
     */
    private fallbackConvertPixelToData(pixelPoint: [number, number]): number | null {
        if (!this.chart) return null;

        const extendedChart = this.chart as EChartsExtended;
        const dataPoint = extendedChart.convertFromPixel({ gridIndex: 0 }, pixelPoint);

        return dataPoint && typeof dataPoint[0] === 'number' ? dataPoint[0] : null;
    }

    /**
     * Add event listener
     */
    on<K extends keyof LabelDrawingEvents>(
        event: K,
        listener: (data: LabelDrawingEvents[K]) => void
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
    off<K extends keyof LabelDrawingEvents>(
        event: K,
        listener: (data: LabelDrawingEvents[K]) => void
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
    private emit<K extends keyof LabelDrawingEvents>(event: K, data: LabelDrawingEvents[K]): void {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            eventListeners.forEach((listener) => {
                listener(data);
            });
        }
    }

    /**
     * Enable interactive label drawing
     */
    private enableDrawing(): void {
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
            series: {
                silent: true,
            },
        });

        // Setup canvas overlay for real-time drawing
        this.setupCanvas();

        // Setup drawing event listeners
        this.setupEventListeners();
    }

    /**
     * Disable interactive label drawing and restore default interactions
     */
    private disableDrawing(): void {
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

        // Clean up canvas overlay
        this.cleanupCanvas();

        // Reset drawing state
        this.isDrawing = false;
        this.drawStartX = null;
        this.clearDrawingGraphics();
    }

    /**
     * Setup canvas overlay for real-time drawing feedback
     */
    private setupCanvas(): void {
        if (!this.chart) return;

        const chartContainer = this.chart.getDom();
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- getDom() can return null
        if (!chartContainer) return;

        // Create canvas overlay
        this.drawingCanvas = document.createElement('canvas');
        this.drawingCanvas.style.position = 'absolute';
        this.drawingCanvas.style.top = '0';
        this.drawingCanvas.style.left = '0';
        this.drawingCanvas.style.pointerEvents = 'none'; // Allow mouse events to pass through
        this.drawingCanvas.style.zIndex = '1000';

        // Size the canvas to match the chart
        this.resizeCanvas();

        // Add to container
        chartContainer.style.position = 'relative';
        chartContainer.appendChild(this.drawingCanvas);
    }

    /**
     * Resize the drawing canvas to match the chart container
     */
    resizeCanvas(): void {
        if (!this.chart || !this.drawingCanvas) return;

        const chartContainer = this.chart.getDom();
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- getDom() can return null
        if (!chartContainer) return;

        const containerRect = chartContainer.getBoundingClientRect();
        this.drawingCanvas.width = containerRect.width;
        this.drawingCanvas.height = containerRect.height;
    }

    /**
     * Clean up the drawing canvas overlay
     */
    private cleanupCanvas(): void {
        if (this.drawingCanvas && this.drawingCanvas.parentElement) {
            this.drawingCanvas.parentElement.removeChild(this.drawingCanvas);
            this.drawingCanvas = null;
        }
    }

    /**
     * Setup event listeners for label drawing
     */
    private setupEventListeners(): void {
        if (!this.chart) {
            return;
        }

        // Listen to mouse events for drawing
        const extendedChart = this.chart as EChartsExtended;
        extendedChart.getZr().on('mousedown', this.handleMouseDown.bind(this));
        extendedChart.getZr().on('mousemove', this.handleMouseMove.bind(this));
        extendedChart.getZr().on('mouseup', this.handleMouseUp.bind(this));
        extendedChart.getDom().addEventListener('pointerleave', this.handlePointerLeave.bind(this));
    }

    /**
     * Handle mouse down for label drawing
     */
    private handleMouseDown(event: ZRenderMouseEvent): void {
        if (!this.chart || !this.enabled) return;

        // Allow drawing anywhere in the chart area
        // The event comes from the zrender canvas, so we can proceed
        const pixelPoint: [number, number] = [event.offsetX, event.offsetY];

        let startX: number | null;

        if (this.snapping) {
            // Apply snapping logic to find the closest data point
            startX = this.findClosestDataPointX(pixelPoint[0]);
            if (startX === null) {
                startX = this.fallbackConvertPixelToData(pixelPoint);
            }
        } else {
            startX = this.fallbackConvertPixelToData(pixelPoint);
        }

        if (typeof startX === 'number') {
            this.isDrawing = true;
            this.drawStartX = startX;
            // Show initial canvas line at the start position
            this.showCanvasPreviewLine(pixelPoint[0]);
        }
    }

    /**
     * Handle mouse move for label drawing
     */
    private handleMouseMove(event: ZRenderMouseEvent): void {
        if (!this.chart || !this.enabled) {
            return;
        }

        const pixelPoint: [number, number] = [event.offsetX, event.offsetY];

        if (this.isDrawing && this.drawStartX !== null) {
            // Update drawing rectangle using canvas overlay for real-time feedback
            this.updateDrawingRectangle(pixelPoint);
        } else {
            // Show preview line when hovering using canvas
            if (typeof pixelPoint[0] === 'number') {
                this.showCanvasPreviewLine(pixelPoint[0]);
            }
        }
    }

    /**
     * Handle mouse up to finalize label drawing
     */
    private handleMouseUp(event: ZRenderMouseEvent): void {
        if (!this.chart || !this.enabled || !this.isDrawing || this.drawStartX === null) return;

        const pixelPoint: [number, number] = [event.offsetX, event.offsetY];

        let endX: number | null;

        if (this.snapping) {
            // Apply snapping logic to find the closest data point
            endX = this.findClosestDataPointX(pixelPoint[0]);
            if (endX === null) {
                endX = this.fallbackConvertPixelToData(pixelPoint);
            }
        } else {
            endX = this.fallbackConvertPixelToData(pixelPoint);
        }

        if (typeof endX === 'number') {
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

    private handlePointerLeave(_event: PointerEvent): void {
        this.hideCanvasPreviewLine();
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

        let finalX = pixelX;

        if (this.snapping) {
            // Get chart data to find nearest data point
            const chartOption = this.chart.getOption();
            const series = chartOption.series as Array<{ data: Array<[number, number]> }>;

            if (series && series[0] && series[0].data && Array.isArray(series[0].data)) {
                const seriesData = series[0].data;

                // Convert current pixel to data coordinate to find nearest point
                const extendedChart = this.chart as EChartsExtended;
                const dataPoint = extendedChart.convertFromPixel({ gridIndex: 0 }, [
                    pixelX,
                    chartArea.y,
                ]);

                if (dataPoint && typeof dataPoint[0] === 'number') {
                    const targetX = dataPoint[0];

                    // Find the closest data point
                    let closestPoint = seriesData[0];
                    let minDistance = Math.abs((seriesData[0]?.[0] ?? 0) - targetX);

                    for (let i = 1; i < seriesData.length; i++) {
                        const currentPoint = seriesData[i];
                        if (currentPoint && typeof currentPoint[0] === 'number') {
                            const distance = Math.abs(currentPoint[0] - targetX);
                            if (distance < minDistance) {
                                minDistance = distance;
                                closestPoint = currentPoint;
                            }
                        }
                    }

                    // Convert the closest data point back to pixel coordinates
                    if (
                        closestPoint &&
                        typeof closestPoint[0] === 'number' &&
                        typeof closestPoint[1] === 'number'
                    ) {
                        const snappedPixel = extendedChart.convertToPixel({ gridIndex: 0 }, [
                            closestPoint[0],
                            closestPoint[1],
                        ]);

                        if (snappedPixel && typeof snappedPixel[0] === 'number') {
                            finalX = snappedPixel[0];
                        }
                    }
                }
            }
        }

        // Get the color for the current label definition (solid, no transparency)
        const lineColor = this.currentLabelDefId
            ? this.getLabelColor(this.currentLabelDefId, 1.0)
            : '#007bff';

        // Draw vertical line at final position (snapped or exact mouse position)
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 2;

        // Use different line style to indicate snapping state
        if (this.snapping) {
            ctx.setLineDash([]); // Solid line for snapped
        } else {
            ctx.setLineDash([4, 4]); // Dashed line for non-snapped
        }

        ctx.beginPath();
        ctx.moveTo(finalX, chartArea.y);
        ctx.lineTo(finalX, chartArea.y + chartArea.height);
        ctx.stroke();
    }

    private hideCanvasPreviewLine(): void {
        if (!this.drawingCanvas) return;

        const ctx = this.drawingCanvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, this.drawingCanvas.width, this.drawingCanvas.height);
    }

    /**
     * Update the drawing rectangle on canvas overlay (real-time)
     */
    private updateDrawingRectangle(pixelPoint: [number, number]): void {
        if (!this.chart || !this.drawingCanvas || this.drawStartX === null) return;

        // Get snapped pixel coordinates for both start and current positions
        const extendedChart = this.chart as EChartsExtended;
        const startPixel = extendedChart.convertToPixel({ gridIndex: 0 }, [this.drawStartX, 0]);

        let currentX = pixelPoint[0];

        if (this.snapping) {
            // Get chart data to find nearest data point for current position
            const chartOption = this.chart.getOption();
            const series = chartOption.series as Array<{ data: Array<[number, number]> }>;

            if (series && series[0] && series[0].data && Array.isArray(series[0].data)) {
                const seriesData = series[0].data;

                // Convert current pixel to data coordinate to find nearest point
                const currentDataPoint = extendedChart.convertFromPixel(
                    { gridIndex: 0 },
                    pixelPoint
                );

                if (currentDataPoint && typeof currentDataPoint[0] === 'number') {
                    const targetX = currentDataPoint[0];

                    // Find the closest data point
                    let closestPoint = seriesData[0];
                    let minDistance = Math.abs((seriesData[0]?.[0] ?? 0) - targetX);

                    for (let i = 1; i < seriesData.length; i++) {
                        const currentPoint = seriesData[i];
                        if (currentPoint && typeof currentPoint[0] === 'number') {
                            const distance = Math.abs(currentPoint[0] - targetX);
                            if (distance < minDistance) {
                                minDistance = distance;
                                closestPoint = currentPoint;
                            }
                        }
                    }

                    // Convert the closest data point back to pixel coordinates
                    if (
                        closestPoint &&
                        typeof closestPoint[0] === 'number' &&
                        typeof closestPoint[1] === 'number'
                    ) {
                        const snappedPixel = extendedChart.convertToPixel({ gridIndex: 0 }, [
                            closestPoint[0],
                            closestPoint[1],
                        ]);

                        if (snappedPixel && typeof snappedPixel[0] === 'number') {
                            currentX = snappedPixel[0];
                        }
                    }
                }
            }
        }

        // Get the actual chart plotting area (where data is displayed)
        const chartArea = this.getChartPlottingArea();

        if (!startPixel || !chartArea || typeof startPixel[0] !== 'number') {
            return;
        }

        const ctx = this.drawingCanvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, this.drawingCanvas.width, this.drawingCanvas.height);

        const startX = startPixel[0];
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

        // Use different line style to indicate snapping state
        if (this.snapping) {
            ctx.setLineDash([]); // Solid line for snapped
        } else {
            ctx.setLineDash([4, 4]); // Dashed line for non-snapped
        }

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
     * Finalize the label drawing and create the label
     */
    private finalizeLabelDrawing(startX: number, endX: number): void {
        if (!this.currentLabelDefId || !this.datasetId) return;

        // Ensure proper order
        const actualStartX = Math.min(startX, endX);
        const actualEndX = Math.max(startX, endX);

        // Prevent creating labels that are too narrow (1 point wide or less)
        const labelWidth = Math.abs(actualEndX - actualStartX);
        const minLabelWidth = 1; // Minimum time difference to create a meaningful label

        if (labelWidth < minLabelWidth) {
            // Label too narrow, minimum width required
            return; // Don't create the label
        }

        // Create the label
        try {
            const label: TimeSeriesLabel = {
                id: crypto.randomUUID(),
                startTime: actualStartX,
                endTime: actualEndX,
                labelDefId: this.currentLabelDefId,
                datasetId: this.datasetId,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };

            // Emit event
            this.emit('label-drawn', { label });
        } catch (_error) {
            // Failed to create label - silent handling
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
        this.cleanupCanvas();
        this.listeners.clear();
    }
}
