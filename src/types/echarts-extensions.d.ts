/**
 * Type extensions for ECharts that aren't in the main type definitions
 * This eliminates the need for 'any' casts when accessing ECharts internals
 */

import type { ECharts } from 'echarts';

/**
 * Mouse event from zrender (ECharts' underlying rendering library)
 */
export interface ZRenderMouseEvent {
    offsetX: number;
    offsetY: number;
    target?: unknown;
    event?: MouseEvent;
}

/**
 * ZRender instance that handles low-level rendering and events
 */
export interface ZRenderInstance {
    on(
        eventType: 'mousedown' | 'mousemove' | 'mouseup' | 'click',
        handler: (event: ZRenderMouseEvent) => void
    ): void;
    off(
        eventType: 'mousedown' | 'mousemove' | 'mouseup' | 'click',
        handler?: (event: ZRenderMouseEvent) => void
    ): void;
}

/**
 * Coordinate conversion finder for ECharts
 */
export interface CoordinateFinder {
    gridIndex?: number;
    xAxisIndex?: number;
    yAxisIndex?: number;
    seriesIndex?: number;
}

/**
 * Extended ECharts interface with access to zrender and coordinate conversion
 */
export interface EChartsExtended extends ECharts {
    /**
     * Get the underlying zrender instance for low-level event handling
     */
    getZr(): ZRenderInstance;

    /**
     * Convert pixel coordinates to data coordinates
     * @param finder - Specifies which coordinate system to use
     * @param pixel - Pixel coordinates [x, y]
     * @returns Data coordinates [x, y] or null if conversion fails
     */
    convertFromPixel(finder: CoordinateFinder, pixel: [number, number]): [number, number] | null;

    /**
     * Convert data coordinates to pixel coordinates
     * @param finder - Specifies which coordinate system to use
     * @param value - Data coordinates [x, y]
     * @returns Pixel coordinates [x, y] or null if conversion fails
     */
    convertToPixel(finder: CoordinateFinder, value: [number, number]): [number, number] | null;
}

/**
 * Type guard to check if an ECharts instance has extended functionality
 */
export function isEChartsExtended(chart: ECharts): chart is EChartsExtended {
    return (
        typeof (chart as any).getZr === 'function' &&
        typeof (chart as any).convertFromPixel === 'function'
    );
}
