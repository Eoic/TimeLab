import type { EChartOption, ECharts } from './echarts';

import type { TLDropdown } from '@/components/dropdown';

export function setupChartConfigControls(
    chart: ECharts,
    dataProvider: () => Array<[number, number]>
): () => void {
    const elSmooth = document.querySelector<HTMLInputElement>('#cfg-smooth');
    const elArea = document.querySelector<HTMLInputElement>('#cfg-area');
    const elLineWidth = document.querySelector<HTMLInputElement>('#cfg-linewidth');
    const elPoints = document.querySelector<HTMLInputElement>('#cfg-points');
    const elSampling = document.querySelector<TLDropdown>('#cfg-sampling');
    const elXType = document.querySelector<TLDropdown>('#cfg-x-type');
    const elYType = document.querySelector<TLDropdown>('#cfg-y-type');
    const elYAuto = document.querySelector<HTMLInputElement>('#cfg-y-auto');
    const elYMin = document.querySelector<HTMLInputElement>('#cfg-y-min');
    const elYMax = document.querySelector<HTMLInputElement>('#cfg-y-max');
    const elGridlines = document.querySelector<HTMLInputElement>('#cfg-gridlines');
    const elTooltip = document.querySelector<TLDropdown>('#cfg-tooltip');
    const elSnap = document.querySelector<HTMLInputElement>('#cfg-snap');
    const elThreshEnable = document.querySelector<HTMLInputElement>('#cfg-threshold-enable');
    const elThreshValue = document.querySelector<HTMLInputElement>('#cfg-threshold-value');
    const elZoomPreset = document.querySelector<TLDropdown>('#cfg-zoom-preset');
    const elFit = document.querySelector<HTMLButtonElement>('#cfg-fit');

    const applyOption = () => {
        const data = dataProvider();
        let xType: 'category' | 'time' | 'value' = 'category';

        switch (elXType?.value) {
            case 'time':
                xType = 'time';
                break;
            case 'numeric':
                xType = 'value';
                break;
            case 'index':
            default:
                xType = 'category';
        }

        const yType = elYType?.value === 'log' ? 'log' : 'value';
        const showGrid = !!elGridlines?.checked;
        const smooth = !!elSmooth?.checked;
        const showArea = !!elArea?.checked;
        const showSymbol = !!elPoints?.checked;
        const lineWidth = Number(elLineWidth?.value || 2);

        type Sampling = 'lttb' | 'average' | 'max' | 'min';
        let sampling: Sampling | undefined;

        switch (elSampling?.value ?? 'none') {
            case 'lttb':
            case 'average':
            case 'max':
            case 'min':
                sampling = (elSampling?.value ?? 'none') as Sampling;
                break;
            default:
                sampling = undefined;
        }

        const tooltipMode = elTooltip?.value ?? 'axis';
        const snap = !!elSnap?.checked;
        const yAuto = !!elYAuto?.checked;
        const yMin = !yAuto && elYMin?.value !== '' ? Number(elYMin?.value) : undefined;
        const yMax = !yAuto && elYMax?.value !== '' ? Number(elYMax?.value) : undefined;

        const xAxis: EChartOption.XAxis = {
            type: xType as EChartOption.XAxis['type'],
            boundaryGap: xType === 'category',
        };

        let seriesData: Array<[number | string, number]> = data;

        if (xType === 'category') {
            seriesData = data.map((_pair, i) => [String(i), data[i]?.[1] ?? NaN]);
        } else {
            seriesData = data;
        }

        const yAxis: EChartOption.YAxis = {
            type: yType as EChartOption.YAxis['type'],
            scale: yAuto,
        };

        if (yMin !== undefined) {
            yAxis.min = yMin;
        }

        if (yMax !== undefined) {
            yAxis.max = yMax;
        }

        // If auto-scaling and all Y values are identical (e.g., all 0),
        // pad the axis slightly so the line is visible.
        const axisLineStyle = showGrid ? {} : { show: false };
        const splitLine = { show: showGrid };

        let markLine: EChartOption.SeriesLine['markLine'] | undefined;
        const thresholdEnabled = elThreshEnable?.checked ?? false;
        const thresholdVal =
            elThreshValue && elThreshValue.value !== '' ? Number(elThreshValue.value) : undefined;

        if (thresholdEnabled && thresholdVal !== undefined) {
            markLine = {
                data: [{ yAxis: thresholdVal }],
                lineStyle: { type: 'dashed' },
                symbol: 'none',
            } as unknown as EChartOption.SeriesLine['markLine'];
        }

        chart.setOption(
            {
                tooltip:
                    tooltipMode === 'none'
                        ? { show: false }
                        : {
                              trigger: tooltipMode as EChartOption.Tooltip['trigger'],
                              axisPointer: { type: 'cross', snap },
                          },
                xAxis: { ...xAxis, axisLine: axisLineStyle, splitLine },
                yAxis: { ...yAxis, axisLine: axisLineStyle, splitLine },
                series: [
                    {
                        type: 'line',
                        smooth,
                        showSymbol,
                        sampling,
                        lineStyle: { width: lineWidth },
                        areaStyle: showArea ? {} : undefined,
                        markLine,
                        data: seriesData,
                    },
                ],
            },
            false,
            true
        );
    };

    const onInput = () => {
        applyOption();
    };

    elSmooth?.addEventListener('change', onInput);
    elArea?.addEventListener('change', onInput);
    elLineWidth?.addEventListener('input', onInput);
    elPoints?.addEventListener('change', onInput);
    elSampling?.addEventListener('change', onInput as EventListener);
    elXType?.addEventListener('change', onInput as EventListener);
    elYType?.addEventListener('change', onInput as EventListener);

    if (elYAuto) {
        elYAuto.addEventListener('change', () => {
            const enabled = elYAuto.checked;
            if (elYMin) {
                elYMin.disabled = enabled;
            }
            if (elYMax) {
                elYMax.disabled = enabled;
            }
            applyOption();
        });
    }

    elYMin?.addEventListener('input', onInput);
    elYMax?.addEventListener('input', onInput);
    elGridlines?.addEventListener('change', onInput);
    elTooltip?.addEventListener('change', onInput as EventListener);
    elSnap?.addEventListener('change', onInput);

    if (elThreshEnable) {
        elThreshEnable.addEventListener('change', () => {
            const enabled = elThreshEnable.checked;
            if (elThreshValue) {
                elThreshValue.disabled = !enabled;
            }
            applyOption();
        });
    }

    elThreshValue?.addEventListener('input', onInput);

    const applyZoomPreset = (preset: string) => {
        const setRange = (startPercent: number, endPercent: number) => {
            chart.setOption({ dataZoom: [{ start: startPercent, end: endPercent }] });
        };

        switch (preset) {
            case 'last10':
                setRange(90, 100);
                break;
            case 'last25':
                setRange(75, 100);
                break;
            case 'last50':
                setRange(50, 100);
                break;
            default:
                setRange(0, 100);
                break;
        }
    };

    elZoomPreset?.addEventListener('change', () => {
        applyZoomPreset(String(elZoomPreset.value));
    });

    elFit?.addEventListener('click', () => {
        applyZoomPreset('fit');
    });

    // Expose a way to recompute using current UI state
    return () => {
        applyOption();
    };
}
