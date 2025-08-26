/**
 * Chart creation utilities using the legacy ECharts setup
 * Bridge between legacy vendor setup and domain logic
 */

import type { Result } from '../shared';
import { ChartError, ok, err } from '../shared';

import { loadECharts } from './echarts';
import type { ECharts, EChartOption } from './echarts';

/**
 * Create a main chart instance with proper error handling
 */
export async function createMainChart(
    el: HTMLDivElement,
    themeName?: string
): Promise<Result<ECharts, ChartError>> {
    try {
        const echarts = await loadECharts();
        const chart = echarts.init(el, themeName ?? undefined);
        return ok(chart);
    } catch (error) {
        return err(new ChartError('Failed to create chart', error));
    }
}

/**
 * Type-safe chart option builder for line charts
 */
export function buildLineChartOptions(data: Array<[number, number]>): EChartOption {
    return {
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            containLabel: true,
        },
        xAxis: {
            type: 'time',
        },
        yAxis: {
            type: 'value',
        },
        series: [
            {
                type: 'line',
                data,
                smooth: false,
                symbol: 'none',
                sampling: 'lttb',
            },
        ],
        tooltip: {
            trigger: 'axis',
        },
        dataZoom: [
            {
                type: 'inside',
                xAxisIndex: 0,
            },
            {
                type: 'slider',
                xAxisIndex: 0,
                bottom: 10,
            },
        ],
    };
}
