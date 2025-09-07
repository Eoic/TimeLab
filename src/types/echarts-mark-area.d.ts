/**
 * Type definitions for ECharts markArea data structure
 */

export interface MarkAreaItemStyle {
    color?: string;
    borderColor?: string;
    borderWidth?: number;
    borderType?: 'solid' | 'dashed' | 'dotted';
    opacity?: number;
}

export interface MarkAreaLabel {
    show?: boolean;
    position?: string;
    formatter?: string | ((params: any) => string);
}

export interface MarkAreaDataPoint {
    xAxis?: number | string;
    yAxis?: number | string;
    type?: string;
    valueIndex?: number;
    valueDim?: string;
    coord?: [number, number];
    name?: string;
    x?: number;
    y?: number;
    value?: number;
    itemStyle?: MarkAreaItemStyle;
    label?: MarkAreaLabel;
}

export type MarkAreaDataPair = [MarkAreaDataPoint, MarkAreaDataPoint];

export interface MarkAreaSeries {
    silent?: boolean;
    data: MarkAreaDataPair[];
}
