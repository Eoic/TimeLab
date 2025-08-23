import { defineDropdown, TLDropdown } from '@/components/dropdown';
import { setupApp } from '@/utils/app';
import { init, type EChartOption, type ECharts } from '@/vendor/echarts';
import '../styles/main.scss';

setupApp();
defineDropdown();

// Example: render a simple time-series line chart into the #chart card
async function setupTimeSeriesDemo(): Promise<void> {
  const host = document.querySelector<HTMLDivElement>('#chart');
  if (!host) {
    return;
  }

  // Use dedicated canvas area inside the chart card
  const container = document.querySelector<HTMLDivElement>('#chart-canvas') ?? host;
  container.style.width = '100%';
  container.style.height = '100%';
  container.setAttribute('role', 'img');
  container.setAttribute('aria-label', 'Time series chart');
  // Make focusable for accessibility and programmatic focus moves
  container.tabIndex = -1;

  // Generate some demo data: 200 points, 1s apart
  const now = Date.now();
  const points: Array<[number, number]> = Array.from({ length: 200 }, (_, i) => {
    const t = now - (200 - i) * 1000; // past to present
    const v = 50 + 10 * Math.sin(i / 8) + 5 * Math.cos(i / 3) + (Math.random() - 0.5) * 4;
    return [t, Number(v.toFixed(2))];
  });

  const option: EChartOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    grid: { left: 40, right: 16, top: 16, bottom: 65 },
    xAxis: { type: 'time', boundaryGap: false },
    yAxis: { type: 'value', scale: true, splitNumber: 4 },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0 },
      { type: 'slider', xAxisIndex: 0, bottom: 8, start: 0, end: 100, throttle: 50, showDetail: false },
    ],
    series: [
      {
        type: 'line',
        name: 'Signal',
        showSymbol: false,
        smooth: true,
        lineStyle: { width: 2 },
        areaStyle: {},
        data: points,
      },
    ],
  };

  const chart = await init(container);
  chart.setOption(option);

  const onResize = () => {
    chart.resize();
  };

  window.addEventListener('resize', onResize);

  // Expose for other handlers
  (window as unknown as { __timestudioChart?: ECharts }).__timestudioChart = chart;

  // Configuration wiring
  setupChartConfigControls(chart, points);
}

void setupTimeSeriesDemo();

// Wire dropdowns (UI only)
function setupDropdowns(): void {
  const x = document.querySelector<TLDropdown>('#x-axis');
  const y = document.querySelector<TLDropdown>('#y-axis');
  const active = document.querySelector<TLDropdown>('#active-label');
  // Config dropdowns
  const cfgXType = document.querySelector<TLDropdown>('#cfg-x-type');
  const cfgYType = document.querySelector<TLDropdown>('#cfg-y-type');
  const cfgSampling = document.querySelector<TLDropdown>('#cfg-sampling');
  const cfgTooltip = document.querySelector<TLDropdown>('#cfg-tooltip');
  const cfgZoom = document.querySelector<TLDropdown>('#cfg-zoom-preset');
  const columns = [
    { value: 'time', label: 'time' },
    { value: 'index', label: 'index' },
    { value: 'epoch', label: 'epoch' },
    { value: 'custom', label: 'custom…' },
  ];
  const measures = [
    { value: 'value', label: 'value' },
    { value: 'signal', label: 'signal' },
    { value: 'temperature', label: 'temperature' },
    { value: 'pressure', label: 'pressure' },
    { value: 'acc_x', label: 'acc_x' },
    { value: 'acc_y', label: 'acc_y' },
    { value: 'acc_z', label: 'acc_z' },
  ];
  if (x) {
    x.options = columns;
  }
  if (y) {
    y.options = measures;
  }
  if (cfgXType) {
    cfgXType.options = [
      { value: 'time', label: 'Time' },
      { value: 'index', label: 'Index' },
    ];
    cfgXType.value = 'time';
  }
  if (cfgYType) {
    cfgYType.options = [
      { value: 'value', label: 'Linear' },
      { value: 'log', label: 'Logarithmic' },
    ];
    cfgYType.value = 'value';
  }
  if (cfgSampling) {
    cfgSampling.options = [
      { value: 'none', label: 'None' },
      { value: 'lttb', label: 'LTTB (quality)' },
      { value: 'average', label: 'Average' },
      { value: 'max', label: 'Max' },
      { value: 'min', label: 'Min' },
    ];
    cfgSampling.value = 'none';
  }
  if (cfgTooltip) {
    cfgTooltip.options = [
      { value: 'axis', label: 'Axis crosshair' },
      { value: 'item', label: 'Item' },
      { value: 'none', label: 'None' },
    ];
    cfgTooltip.value = 'axis';
  }
  if (cfgZoom) {
    cfgZoom.options = [
      { value: 'fit', label: 'Fit (all)' },
      { value: 'last10', label: 'Last 10%' },
      { value: 'last25', label: 'Last 25%' },
      { value: 'last50', label: 'Last 50%' },
    ];
    cfgZoom.value = 'fit';
  }
  if (active) {
    active.options = [
      { value: 'label-a', label: 'Label A', color: '#e74c3c' },
      { value: 'label-b', label: 'Label B', color: '#f1c40f' },
      { value: 'label-c', label: 'Label C', color: '#2ecc71' },
      { value: 'label-d', label: 'Label D', color: '#3498db' },
    ];
  }
  x?.addEventListener('change', (ev: Event) => {
    const ce = ev as CustomEvent<{ value?: unknown }>;
    const val = typeof ce.detail.value === 'string' ? ce.detail.value : '';
    if (val) {
      (ev.currentTarget as HTMLElement).setAttribute('data-selected', val);
    }
  });
  y?.addEventListener('change', (ev: Event) => {
    const ce = ev as CustomEvent<{ value?: unknown }>;
    const val = typeof ce.detail.value === 'string' ? ce.detail.value : '';
    if (val) {
      (ev.currentTarget as HTMLElement).setAttribute('data-selected', val);
    }
  });
}

setupDropdowns();

// Collapsible side panels
function setupCollapsiblePanels(): void {
  const root = document.querySelector<HTMLDivElement>('.container');
  if (!root) {
    return;
  }

  const btnLeft = document.querySelector<HTMLButtonElement>("[data-action='toggle-config']");
  const btnRight = document.querySelector<HTMLButtonElement>("[data-action='toggle-labctrl']");
  const btnBottom = document.querySelector<HTMLButtonElement>("[data-action='toggle-stats']");
  const config = document.getElementById('panel-config');
  const lab = document.getElementById('panel-labctrl');
  const stats = document.getElementById('panel-stats');

  const updateAriaAndIcons = () => {
    const leftCollapsed = root.classList.contains('collapse-left');
    const rightCollapsed = root.classList.contains('collapse-right');
    const bottomCollapsed = root.classList.contains('collapse-bottom');
    if (btnLeft) {
      btnLeft.setAttribute('aria-expanded', String(!leftCollapsed));
      const icon = btnLeft.querySelector('.material-symbols-outlined');
      if (icon) {
        icon.textContent = leftCollapsed ? 'left_panel_open' : 'left_panel_close';
      }
      btnLeft.setAttribute('aria-label', leftCollapsed ? 'Expand configuration panel' : 'Collapse configuration panel');
    }
    if (btnRight) {
      btnRight.setAttribute('aria-expanded', String(!rightCollapsed));
      const icon = btnRight.querySelector('.material-symbols-outlined');
      if (icon) {
        icon.textContent = rightCollapsed ? 'right_panel_open' : 'right_panel_close';
      }
      btnRight.setAttribute('aria-label', rightCollapsed ? 'Expand labels panel' : 'Collapse labels panel');
    }
    if (btnBottom) {
      btnBottom.setAttribute('aria-expanded', String(!bottomCollapsed));
      const icon = btnBottom.querySelector('.material-symbols-outlined');
      if (icon) {
        icon.textContent = bottomCollapsed ? 'bottom_panel_open' : 'bottom_panel_close';
      }
      btnBottom.setAttribute('aria-label', bottomCollapsed ? 'Expand statistics panel' : 'Collapse statistics panel');
    }
  };

  const resizeChartSoon = () => {
    const chart = (window as unknown as { __timestudioChart?: { resize: () => void } }).__timestudioChart;
    // Resize twice with micro delay to handle grid reflow
    if (chart) {
      requestAnimationFrame(() => {
        chart.resize();
      });
      setTimeout(() => {
        chart.resize();
      }, 120);
    }
  };

  btnLeft?.addEventListener('click', () => {
    root.classList.toggle('collapse-left');
    // If both panels hidden, ensure focus isn't trapped
    if (root.classList.contains('collapse-left') && config?.contains(document.activeElement)) {
      const target = document.getElementById('chart-canvas');
      if (target instanceof HTMLElement) {
        target.focus();
      }
    }
    updateAriaAndIcons();
    resizeChartSoon();
  });
  btnRight?.addEventListener('click', () => {
    root.classList.toggle('collapse-right');
    if (root.classList.contains('collapse-right') && lab?.contains(document.activeElement)) {
      const target = document.getElementById('chart-canvas');
      if (target instanceof HTMLElement) {
        target.focus();
      }
    }
    updateAriaAndIcons();
    resizeChartSoon();
  });

  btnBottom?.addEventListener('click', () => {
    root.classList.toggle('collapse-bottom');
    if (root.classList.contains('collapse-bottom') && stats?.contains(document.activeElement)) {
      const target = document.getElementById('chart-canvas');
      if (target instanceof HTMLElement) {
        target.focus();
      }
    }
    updateAriaAndIcons();
    resizeChartSoon();
  });

  updateAriaAndIcons();
}

setupCollapsiblePanels();

// Statistics panel — derive from Labels panel DOM
function setupStatsPanel(): void {
  const labelsList = document.querySelector<HTMLUListElement>('.labels-list');
  const totalEl = document.getElementById('stats-total');
  const typesEl = document.getElementById('stats-types');
  const listEl = document.getElementById('stats-list');

  if (!labelsList || !totalEl || !typesEl || !listEl) {
    return;
  }

  type TCount = { name: string; count: number; color?: string };

  const update = () => {
    const items = Array.from(labelsList.querySelectorAll<HTMLLIElement>('.label-item'));
    // Total is number of label items (ranges created)
    const total = items.length;
    const map = new Map<string, TCount>();

    for (const li of items) {
      const name = (li.querySelector<HTMLElement>('.title')?.textContent || '').trim();
      const dot = li.querySelector<HTMLElement>('.dot');
      // Read inline CSS variable --dot if present
      let color: string | undefined;
      if (dot) {
        const v = dot.style.getPropertyValue('--dot').trim();
        color = v || undefined;
      }
      if (!map.has(name)) {
        let entry: TCount = { name, count: 1 };
        if (color) {
          entry = { ...entry, color };
        }
        map.set(name, entry);
      } else {
        const entry = map.get(name);
        if (entry) {
          entry.count += 1;
          if (!entry.color && color) {
            entry.color = color;
          }
        }
      }
    }

    totalEl.textContent = String(total);
    typesEl.textContent = String(map.size);

    // Render list
    listEl.textContent = '';
    const sorted = Array.from(map.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    for (const row of sorted) {
      const li = document.createElement('li');
      const dot = document.createElement('span');
      dot.className = 'dot';
      if (row.color) {
        (dot as HTMLElement).style.setProperty('--dot', row.color);
      }
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = row.name;
      const count = document.createElement('span');
      count.className = 'count';
      count.textContent = String(row.count);
      li.appendChild(dot);
      li.appendChild(name);
      li.appendChild(count);
      listEl.appendChild(li);
    }
  };

  // Observe changes to the labels list (add/remove/edit)
  const observer = new MutationObserver(() => {
    update();
  });
  observer.observe(labelsList, { childList: true, subtree: true });

  // Wire delete buttons to update stats when removing
  labelsList.addEventListener('click', (ev: Event) => {
    const target = ev.target as HTMLElement | null;
    if (!target) {
      return;
    }
    const btn = target.closest('button.delete');
    if (btn) {
      const li = btn.closest('li.label-item');
      if (li && li.parentElement) {
        li.parentElement.removeChild(li);
        update();
      }
    }
  });

  update();
}

setupStatsPanel();

// Wire the configuration panel controls to update the chart
function setupChartConfigControls(chart: ECharts, data: Array<[number, number]>): void {
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
    const xType = elXType?.value === 'index' ? 'category' : 'time';
    const yType = elYType?.value === 'log' ? 'log' : 'value';
    const showGrid = !!elGridlines?.checked;
    const smooth = !!elSmooth?.checked;
    const showArea = !!elArea?.checked;
    const showSymbol = !!elPoints?.checked;
    const lw = Number(elLineWidth?.value || 2);
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

    // Build axis options
    const xAxis: EChartOption.XAxis = { type: xType as EChartOption.XAxis['type'], boundaryGap: xType === 'category' };
    let seriesData: Array<[number | string, number]> = data;
    if (xType === 'category') {
      seriesData = data.map((pair, i) => [String(i), pair[1]]);
    }

    const yAxis: EChartOption.YAxis = { type: yType as EChartOption.YAxis['type'], scale: yAuto };
    if (yMin !== undefined) {
      yAxis.min = yMin;
    }
    if (yMax !== undefined) {
      yAxis.max = yMax;
    }
    const axisLineStyle = showGrid ? {} : { show: false };
    const splitLine = { show: showGrid };

    let markLine: EChartOption.SeriesLine['markLine'] | undefined;
    const thresholdEnabled = elThreshEnable?.checked ?? false;
    const thresholdVal = elThreshValue && elThreshValue.value !== '' ? Number(elThreshValue.value) : undefined;
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
            : { trigger: tooltipMode as EChartOption.Tooltip['trigger'], axisPointer: { type: 'cross', snap } },
        xAxis: { ...xAxis, axisLine: axisLineStyle, splitLine },
        yAxis: { ...yAxis, axisLine: axisLineStyle, splitLine },
        series: [
          {
            type: 'line',
            smooth,
            showSymbol,
            sampling,
            lineStyle: { width: lw },
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
}
