/**
 * Enhanced ECharts type definitions to fix unsafe type assertions
 * Provides properly typed interfaces for chart configuration
 */

/**
 * Safe markLine configuration interface
 * Ensures type safety for threshold lines and other markLine features
 */
export interface SafeMarkLineConfig {
    data: Array<{
        yAxis?: number;
        xAxis?: number | string;
        type?: 'min' | 'max' | 'average';
        name?: string;
    }>;
    lineStyle?: {
        type?: 'solid' | 'dashed' | 'dotted';
        width?: number;
        color?: string;
        opacity?: number;
    };
    symbol?: string | string[] | 'none';
    symbolSize?: number | number[];
    label?: {
        show?: boolean;
        position?: string;
        formatter?: string | ((params: any) => string);
    };
    animation?: boolean;
    animationDuration?: number;
    silent?: boolean;
    precision?: number;
}

/**
 * Safe markArea configuration interface
 * For displaying labeled regions on charts
 */
export interface SafeMarkAreaConfig {
    data: Array<
        Array<{
            xAxis?: number | string;
            yAxis?: number;
            name?: string;
        }>
    >;
    itemStyle?: {
        color?: string;
        opacity?: number;
        borderColor?: string;
        borderWidth?: number;
        borderType?: 'solid' | 'dashed' | 'dotted';
    };
    label?: {
        show?: boolean;
        position?: string;
        formatter?: string | ((params: any) => string);
        color?: string;
        fontSize?: number;
    };
    emphasis?: {
        itemStyle?: {
            color?: string;
            opacity?: number;
            borderColor?: string;
            borderWidth?: number;
        };
    };
    animation?: boolean;
    animationDuration?: number;
    silent?: boolean;
}

/**
 * Enhanced line series configuration with proper typing
 */
export interface SafeLineSeriesConfig {
    type: 'line';
    name?: string;
    data: Array<[number | string, number]>;
    smooth?: boolean;
    showSymbol?: boolean;
    sampling?: 'average' | 'sum' | 'max' | 'min' | 'lttb' | 'none';
    lineStyle?: {
        width?: number;
        type?: 'solid' | 'dashed' | 'dotted';
        color?: string;
        opacity?: number;
    };
    areaStyle?: {
        opacity?: number;
        color?: string | object;
    };
    markLine?: SafeMarkLineConfig;
    markArea?: SafeMarkAreaConfig;
    emphasis?: {
        focus?: 'none' | 'self' | 'series';
        blurScope?: 'coordinateSystem' | 'series' | 'global';
    };
}

/**
 * Type guard to ensure markLine configuration is valid
 */
export function isValidMarkLineConfig(config: any): config is SafeMarkLineConfig {
    return (
        typeof config === 'object' &&
        config !== null &&
        Array.isArray(config.data) &&
        config.data.every(
            (item: any) =>
                typeof item === 'object' &&
                item !== null &&
                (typeof item.yAxis === 'number' ||
                    typeof item.xAxis === 'number' ||
                    typeof item.xAxis === 'string' ||
                    typeof item.type === 'string')
        )
    );
}

/**
 * Type guard to ensure markArea configuration is valid
 */
export function isValidMarkAreaConfig(config: any): config is SafeMarkAreaConfig {
    return (
        typeof config === 'object' &&
        config !== null &&
        Array.isArray(config.data) &&
        config.data.every((item: any) => Array.isArray(item))
    );
}

/**
 * Safe markLine configuration builder for threshold lines
 */
export function createThresholdMarkLine(
    value: number,
    options?: {
        lineStyle?: SafeMarkLineConfig['lineStyle'];
        label?: SafeMarkLineConfig['label'];
        symbol?: SafeMarkLineConfig['symbol'];
    }
): SafeMarkLineConfig {
    return {
        data: [{ yAxis: value }],
        lineStyle: {
            type: 'dashed',
            ...options?.lineStyle,
        },
        symbol: options?.symbol ?? 'none',
        ...(options?.label && { label: options.label }),
    };
}

/**
 * Safe tooltip trigger type
 */
export type SafeTooltipTrigger = 'item' | 'axis' | 'none';

/**
 * Safe axis type
 */
export type SafeAxisType = 'value' | 'category' | 'time' | 'log';

/**
 * Enhanced tooltip configuration
 */
export interface SafeTooltipConfig {
    show?: boolean;
    trigger?: SafeTooltipTrigger;
    axisPointer?: {
        type?: 'line' | 'shadow' | 'cross' | 'none';
        snap?: boolean;
        label?: {
            show?: boolean;
            formatter?: string | ((params: any) => string);
        };
    };
    formatter?: string | ((params: any) => string);
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    textStyle?: {
        color?: string;
        fontSize?: number;
        fontFamily?: string;
    };
}

/**
 * Convert string tooltip mode to safe enum type
 */
export function toSafeTooltipTrigger(mode: string): SafeTooltipTrigger {
    switch (mode) {
        case 'item':
        case 'axis':
        case 'none':
            return mode;
        default:
            return 'axis'; // Safe default
    }
}

/**
 * Convert string axis type to safe enum type
 */
export function toSafeAxisType(type: string): SafeAxisType {
    switch (type) {
        case 'value':
        case 'category':
        case 'time':
        case 'log':
            return type;
        default:
            return 'value'; // Safe default
    }
}
