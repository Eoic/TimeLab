import { setupChartConfigControls } from '@/chart/config';
import type { TLDropdown } from '@/components/dropdown';
import { installModalFocusTrap } from '@/utils/dom';
import { init, type EChartOption, type ECharts } from '@/vendor/echarts';

export async function setupTimeSeriesDemo(): Promise<void> {
    const host = document.querySelector<HTMLDivElement>('#chart');

    if (!host) {
        return;
    }

    const container = document.querySelector<HTMLDivElement>('#chart-canvas') ?? host;
    container.style.width = '100%';
    container.style.height = '100%';
    container.setAttribute('role', 'img');
    container.setAttribute('aria-label', 'Time series chart');
    container.tabIndex = -1;

    const generateSeries = (phase: number, noise = 4) => {
        const now = Date.now();

        return Array.from({ length: 200 }, (_, i) => {
            const t = now - (200 - i) * 1000;
            const v =
                50 +
                10 * Math.sin(i / 8 + phase) +
                5 * Math.cos(i / 3 + phase / 2) +
                (Math.random() - 0.5) * noise;

            return [t, Number(v.toFixed(2))] as [number, number];
        });
    };

    type ParsedTable = { columns: string[]; rows: number[][] };
    const seriesDatasets: Array<ParsedTable> = [];

    let currentSeriesIndex = 0;
    const seriesLabeledFlags: boolean[] = Array.from(
        { length: seriesDatasets.length },
        () => false
    );

    const getAtSafe = <T>(arr: readonly T[], idx: number): T => {
        const n = arr.length;
        if (n === 0) {
            throw new Error('No datasets');
        }
        const i = ((idx % n) + n) % n;
        const v = arr[i];
        if (v === undefined) {
            throw new Error('Index out of bounds');
        }
        return v;
    };

    const getAxesSelection = () => {
        const xDropdown = document.querySelector<TLDropdown>('#x-axis');
        const yDropdown = document.querySelector<TLDropdown>('#y-axis');
        const x = (xDropdown?.value as string) || 'index';
        const y = (yDropdown?.value as string) || 'value';
        return { x, y };
    };

    const syncCfgXTypeToAxes = () => {
        const { x } = getAxesSelection();
        const cfgX = document.querySelector<TLDropdown>('#cfg-x-type');
        if (!cfgX) return;
        if (x === 'index') {
            cfgX.value = 'index';
            return;
        }
        // Inspect current dataset X column to decide between time vs numeric
        const table = seriesDatasets[currentSeriesIndex];
        if (!table) {
            cfgX.value = 'index';
            return;
        }
        const xIdx = table.columns.findIndex((c) => c === x);
        if (xIdx < 0) {
            cfgX.value = 'index';
            return;
        }
        const sample: number[] = [];
        for (
            let i = 0;
            i < table.rows.length && sample.length < 50;
            i += Math.max(1, Math.floor(table.rows.length / 50))
        ) {
            const v = table.rows[i]?.[xIdx];
            if (typeof v === 'number' && Number.isFinite(v)) sample.push(v);
        }
        if (sample.length) {
            const sorted = sample.slice().sort((a, b) => a - b);
            const mid = sorted[Math.floor(sorted.length / 2)] ?? sorted[0] ?? 0;
            // Heuristic: if values look like epoch seconds, treat as time, otherwise numeric
            if (mid > 1e8 && mid < 1e11) {
                cfgX.value = 'time';
            } else if (mid > 1e11) {
                cfgX.value = 'time';
            } else {
                cfgX.value = 'numeric';
            }
        } else {
            cfgX.value = 'numeric';
        }
    };

    const normalizeEpoch = (xs: number[]): number[] => {
        if (xs.length === 0) return xs;
        const finite = xs.filter((v) => Number.isFinite(v));
        if (finite.length === 0) return xs;
        const mid = finite.sort((a, b) => a - b)[Math.floor(finite.length / 2)] ?? finite[0] ?? 0;
        // Heuristic: seconds since epoch ~ 1e9 - 2e10; ms since epoch ~ 1e12 - 2e13
        if (mid > 1e8 && mid < 1e11) {
            return xs.map((v) => (Number.isFinite(v) ? v * 1000 : v));
        }
        return xs;
    };

    const seriesFromTable = (table: ParsedTable): Array<[number, number]> => {
        const { x, y } = getAxesSelection();
        const cols = table.columns;
        let xMode: 'index' | 'column' = 'column';
        let xIdx = cols.findIndex((c) => c === x);
        if (x === 'index') {
            xMode = 'index';
        }
        if (xMode === 'column' && xIdx < 0) {
            // best-effort fallback to common names
            xIdx = cols.findIndex((c) => c.toLowerCase() === 'time' || c.toLowerCase() === 'epoch');
            if (xIdx < 0) xMode = 'index';
        }
        let yIdx = cols.findIndex((c) => c === y);
        if (yIdx < 0) {
            const candidates =
                xMode === 'column' && xIdx >= 0
                    ? cols.map((_c, i) => i).filter((i) => i !== xIdx)
                    : cols.map((_c, i) => i);
            yIdx = candidates.length > 0 ? (candidates[0] ?? 0) : 0;
        }

        // Extract columns
        const ys: number[] = [];
        const xs: number[] = [];
        for (let i = 0; i < table.rows.length; i += 1) {
            const row = table.rows[i] ?? [];
            const yv = row[yIdx] ?? NaN;
            if (!Number.isFinite(yv)) continue;
            const xv = xMode === 'index' ? i : (row[xIdx] ?? NaN);
            if (!Number.isFinite(xv) && xMode !== 'index') continue;
            xs.push(xMode === 'index' ? i : xv);
            ys.push(yv);
        }
        const xsNorm = xMode === 'index' ? xs : normalizeEpoch(xs);
        // Pair and sort by X ascending
        const pairs: Array<[number, number]> = xsNorm.map((xv, i) => [xv, ys[i] ?? NaN]);
        pairs.sort((a, b) => a[0] - b[0]);
        // Drop duplicate Xs to avoid vertical spikes (keep last occurrence)
        const dedup: Array<[number, number]> = [];
        for (const p of pairs) {
            const last = dedup[dedup.length - 1];
            if (last && last[0] === p[0]) {
                dedup[dedup.length - 1] = p;
            } else {
                dedup.push(p);
            }
        }
        return dedup;
    };

    const getCurrent = (): Array<[number, number]> => {
        const table = getAtSafe(seriesDatasets, currentSeriesIndex);
        return seriesFromTable(table);
    };

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
                smooth: true,
                lineStyle: { width: 2 },
                areaStyle: {},
                data: [],
            },
        ],
    };

    const chart = await init(container);
    chart.setOption(option);

    const onResize = () => {
        chart.resize();
    };
    window.addEventListener('resize', onResize);

    (window as unknown as { __timestudioChart?: ECharts }).__timestudioChart = chart;
    (window as unknown as { __datasets?: unknown }).__datasets = seriesDatasets;
    (window as unknown as { __currentSeriesIndex?: number }).__currentSeriesIndex =
        currentSeriesIndex;
    (window as unknown as { __seriesLabeled?: boolean[] }).__seriesLabeled = seriesLabeledFlags;

    const refreshConfig = setupChartConfigControls(chart, () => getCurrent());
    const looksNumeric = (s: string) => /^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(s);

    const detectDelimiter = (line: string): string => {
        // Prefer ; or : over , to avoid breaking decimal commas
        const candidates = [';', ':', ',', '\t'];
        const counts = candidates.map((d) => ({
            d,
            c: (line.match(new RegExp(`\\${d}`, 'g')) || []).length,
        }));
        counts.sort((a, b) => b.c - a.c);
        const best = counts[0];
        return best && best.c > 0 ? best.d : ','; // default to comma if nothing found
    };

    const parseDelimitedTextToTable = (text: string): ParsedTable => {
        // strip BOM if present
        text = text.replace(/^\uFEFF/, '');
        const linesRaw = text.split(/\r?\n/);
        const nonEmpty = linesRaw.filter((l) => l.trim().length > 0);
        let columns: string[] = [];
        const dataRows: number[][] = [];
        if (nonEmpty.length === 0) {
            return { columns: ['time', 'value'], rows: [] };
        }
        const first = nonEmpty[0] ?? '';
        const delim = detectDelimiter(first);
        const splitter = delim === '\t' ? /\t/ : new RegExp('[' + delim + ']');
        const firstCells = first
            .split(splitter)
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        const looksLikeHeader = firstCells.some((s) => !looksNumeric(s));
        if (looksLikeHeader) {
            columns = firstCells.map((s, i) => (s.length ? s : 'col' + String(i + 1)));
        } else {
            columns = firstCells.map((_s, i) => (i === 0 ? 'time' : 'col' + String(i + 1)));
            // treat first as data row
            const nums = firstCells.map((s) => {
                // try number; also allow decimal commas if delimiter isn't comma
                const numStr = delim !== ',' ? s.replace(/,/g, '.') : s;
                const n = Number(numStr);
                if (Number.isFinite(n)) return n;
                const d = Date.parse(s);
                return Number.isFinite(d) ? d : NaN;
            });
            dataRows.push(nums);
        }
        for (let li = 1; li < nonEmpty.length; li += 1) {
            const line = nonEmpty[li] ?? '';
            const cells = line.split(splitter).map((s) => s.trim());
            const nums = cells.map((s) => {
                const numStr = delim !== ',' ? s.replace(/,/g, '.') : s;
                const n = Number(numStr);
                if (Number.isFinite(n)) return n;
                const d = Date.parse(s);
                return Number.isFinite(d) ? d : NaN;
            });
            dataRows.push(nums);
        }
        return { columns, rows: dataRows };
    };

    const applyUploadedFiles = (files: Array<{ text?: string; visible: boolean }>) => {
        const datasets: Array<ParsedTable> = [];
        for (const f of files) {
            if (!f.visible || !f.text) continue;
            const table = parseDelimitedTextToTable(f.text);
            if (table.rows.length) datasets.push(table);
        }
        if (datasets.length === 0) {
            // fall back to demo data when nothing uploaded/visible
            const seriesToTable = (pairs: Array<[number, number]>): ParsedTable => ({
                columns: ['time', 'value'],
                rows: pairs.map(([t, v]) => [t, v]),
            });
            datasets.push(
                seriesToTable(generateSeries(0)),
                seriesToTable(generateSeries(Math.PI / 4)),
                seriesToTable(generateSeries(Math.PI / 2))
            );
        }
        seriesDatasets.length = 0;
        seriesDatasets.push(...datasets);
        // keep labeled flags aligned with dataset length, preserving existing flags where possible
        if (seriesLabeledFlags.length !== seriesDatasets.length) {
            const nextFlags: boolean[] = [];
            for (let i = 0; i < seriesDatasets.length; i += 1) {
                nextFlags[i] = seriesLabeledFlags[i] ?? false;
            }
            seriesLabeledFlags.length = 0;
            seriesLabeledFlags.push(...nextFlags);
        }
        currentSeriesIndex = Math.min(currentSeriesIndex, Math.max(0, seriesDatasets.length - 1));
        chart.setOption({ series: [{ data: getCurrent() }], dataZoom: [{ start: 0, end: 100 }] });
        // Sync the x-axis type control to the current X selection
        syncCfgXTypeToAxes();
        refreshConfig();
        updateIndicator();
    };

    const elPrev = document.getElementById('series-prev') as HTMLButtonElement | null;
    const elNext = document.getElementById('series-next') as HTMLButtonElement | null;
    const elIndicator = document.getElementById('series-indicator');
    const btnGrid = document.getElementById('series-grid') as HTMLButtonElement | null;
    const modal = document.getElementById('modal-series-selector');
    const modalGrid = document.getElementById('series-grid-container');
    const modalClose = document.getElementById('series-modal-close');
    const btnToggleLabeled = document.getElementById('toggle-labeled') as HTMLButtonElement | null;

    const isModalOpen = (): boolean => !!modal && modal.getAttribute('aria-hidden') !== 'true';

    const syncLabeledButton = () => {
        if (!btnToggleLabeled) {
            return;
        }

        const isLabeled = !!seriesLabeledFlags[currentSeriesIndex];
        btnToggleLabeled.setAttribute('aria-pressed', String(isLabeled));
        btnToggleLabeled.setAttribute(
            'aria-label',
            isLabeled ? 'Mark series as unlabeled' : 'Mark series as labeled'
        );
        btnToggleLabeled.setAttribute(
            'title',
            isLabeled ? 'Mark series as unlabeled' : 'Mark series as labeled'
        );

        const icon = btnToggleLabeled.querySelector('.material-symbols-outlined');
        const text = btnToggleLabeled.querySelector('.label');

        if (icon) {
            icon.textContent = isLabeled ? 'verified' : 'hourglass_empty';
        }

        if (text) {
            text.textContent = isLabeled ? 'Labeled' : 'Unlabeled';
        }
    };

    const updateIndicator = () => {
        if (elIndicator) {
            elIndicator.textContent =
                String(currentSeriesIndex + 1) + ' / ' + String(seriesDatasets.length);
        }

        if (elPrev) {
            elPrev.disabled = seriesDatasets.length <= 1;
        }

        if (elNext) {
            elNext.disabled = seriesDatasets.length <= 1;
        }

        if (isModalOpen()) {
            highlightActiveSeriesCell();
        }

        syncLabeledButton();
    };

    updateIndicator();

    // Seed from already-loaded data files if present
    const win = window as unknown as { __dataFiles?: Array<{ text?: string; visible: boolean }> };
    if (Array.isArray(win.__dataFiles)) {
        applyUploadedFiles(win.__dataFiles);
    } else {
        // initialize with demo data initially
        applyUploadedFiles([]);
    }
    // Now that data is present, re-apply config once
    refreshConfig();

    // React to upload changes
    window.addEventListener('timelab:dataFilesChanged', (ev) => {
        const detail = (ev as CustomEvent<{ files: Array<{ text?: string; visible: boolean }> }>)
            .detail;
        applyUploadedFiles(detail.files);
    });

    const applySeries = () => {
        chart.setOption(
            { series: [{ data: getCurrent() }], dataZoom: [{ start: 0, end: 100 }] },
            false,
            true
        );
        (window as unknown as { __currentSeriesIndex?: number }).__currentSeriesIndex =
            currentSeriesIndex;
        updateIndicator();
    };
    elPrev?.addEventListener('click', () => {
        currentSeriesIndex =
            (currentSeriesIndex - 1 + seriesDatasets.length) % seriesDatasets.length;
        applySeries();
    });
    elNext?.addEventListener('click', () => {
        currentSeriesIndex = (currentSeriesIndex + 1) % seriesDatasets.length;
        applySeries();
    });

    btnToggleLabeled?.addEventListener('click', () => {
        seriesLabeledFlags[currentSeriesIndex] = !seriesLabeledFlags[currentSeriesIndex];
        syncLabeledButton();
        if (isModalOpen()) {
            const cell = modalGrid?.querySelector<HTMLButtonElement>(
                `.series-cell[data-index="${String(currentSeriesIndex)}"]`
            );
            if (cell) {
                cell.classList.toggle('labeled', seriesLabeledFlags[currentSeriesIndex]);
            }
        }
    });

    const openSeriesModal = () => {
        if (!modal) {
            return;
        }
        renderSeriesGrid();
        modal.setAttribute('aria-hidden', 'false');
        setTimeout(() => {
            const active = modalGrid?.querySelector<HTMLButtonElement>(
                '.series-cell[aria-selected="true"]'
            );
            active?.focus();
        }, 0);
    };
    const closeSeriesModal = () => {
        if (!modal) {
            return;
        }
        modal.setAttribute('aria-hidden', 'true');
        btnGrid?.focus();
    };

    const highlightActiveSeriesCell = () => {
        if (!modalGrid) {
            return;
        }
        const cells = modalGrid.querySelectorAll<HTMLButtonElement>('.series-cell');
        cells.forEach((el, i) => {
            const isActive = i === currentSeriesIndex;
            el.setAttribute('aria-selected', String(isActive));
            el.tabIndex = isActive ? 0 : -1;
        });
    };

    const renderSeriesGrid = () => {
        if (!modalGrid) {
            return;
        }
        modalGrid.textContent = '';
        for (let i = 0; i < seriesDatasets.length; i += 1) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'series-cell' + (seriesLabeledFlags[i] ? ' labeled' : '');
            btn.setAttribute('role', 'option');
            btn.setAttribute('aria-selected', String(i === currentSeriesIndex));
            btn.dataset.index = String(i);
            btn.tabIndex = i === currentSeriesIndex ? 0 : -1;

            const num = document.createElement('span');
            num.className = 'num';
            num.textContent = String(i + 1);

            btn.appendChild(num);
            btn.addEventListener('click', () => {
                currentSeriesIndex = i;
                applySeries();
                closeSeriesModal();
            });
            modalGrid.appendChild(btn);
        }
    };

    btnGrid?.addEventListener('click', () => {
        openSeriesModal();
    });

    // Re-render when axis dropdowns change
    document.querySelector<TLDropdown>('#x-axis')?.addEventListener('change', () => {
        syncCfgXTypeToAxes();
        applySeries();
        refreshConfig();
    });
    document.querySelector<TLDropdown>('#y-axis')?.addEventListener('change', () => {
        applySeries();
        refreshConfig();
    });
    modal?.addEventListener('click', (ev) => {
        const target = ev.target as HTMLElement | null;
        if (!target) {
            return;
        }
        if (target.hasAttribute('data-close') || target === modal) {
            closeSeriesModal();
        }
    });
    modalClose?.addEventListener('click', () => {
        closeSeriesModal();
    });

    if (modal) {
        installModalFocusTrap(modal, closeSeriesModal);
    }
}
