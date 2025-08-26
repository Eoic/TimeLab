import type { TLDropdown } from '@/components/dropdown';
import type { TDataFile } from '@/uploads';

/**
 * Update the active label dropdown to show labels from the labels list
 */
// Label definitions registry (in a real app, this would be in a proper store/service)
const labelDefinitions: Array<{ name: string; color: string }> = [];

export function updateActiveLabelDropdown(): void {
    const activeLabelDropdown = document.querySelector<TLDropdown>('#active-label');

    if (!activeLabelDropdown) {
        return;
    }

    if (labelDefinitions.length === 0) {
        // No label definitions yet - show placeholder
        activeLabelDropdown.options = [{ value: '', label: 'No labels created yet' }];
        activeLabelDropdown.value = '';
        return;
    }

    // Create options from label definitions
    const options = labelDefinitions.map((def, index) => ({
        value: `label-${String(index)}`,
        label: def.name,
        color: def.color,
    }));

    activeLabelDropdown.options = options;

    // If no value is currently selected, select the first one
    if (!activeLabelDropdown.value && options.length > 0 && options[0]) {
        activeLabelDropdown.value = options[0].value;
    }
}

/**
 * Add a new label definition to the registry
 */
export function addLabelDefinition(name: string, color: string): void {
    labelDefinitions.push({ name, color });
    updateActiveLabelDropdown();
}

/**
 * Get all label definitions
 */
export function getLabelDefinitions(): Array<{ name: string; color: string }> {
    return [...labelDefinitions]; // Return a copy to prevent direct mutation
}

/**
 * Update an existing label definition
 */
export function updateLabelDefinition(index: number, name: string, color: string): void {
    if (index >= 0 && index < labelDefinitions.length) {
        labelDefinitions[index] = { name, color };
        updateActiveLabelDropdown();
    }
}

/**
 * Delete a label definition
 */
export function deleteLabelDefinition(index: number): void {
    if (index >= 0 && index < labelDefinitions.length) {
        labelDefinitions.splice(index, 1);
        updateActiveLabelDropdown();
    }
}

export function setupDropdowns(): void {
    const xAxisDropdown = document.querySelector<TLDropdown>('#x-axis');
    const yAxisDropdown = document.querySelector<TLDropdown>('#y-axis');
    const activeLabelDropdown = document.querySelector<TLDropdown>('#active-label');
    const cfgXType = document.querySelector<TLDropdown>('#cfg-x-type');
    const cfgYType = document.querySelector<TLDropdown>('#cfg-y-type');
    const cfgSampling = document.querySelector<TLDropdown>('#cfg-sampling');
    const cfgTooltip = document.querySelector<TLDropdown>('#cfg-tooltip');
    const cfgZoom = document.querySelector<TLDropdown>('#cfg-zoom-preset');

    const setAxisOptions = (cols: string[] | null) => {
        if (!xAxisDropdown || !yAxisDropdown) {
            return;
        }
        if (!cols || cols.length === 0) {
            // Show empty state for dropdowns when no data is available
            const emptyOption = { value: '', label: 'No data available' };
            xAxisDropdown.options = [emptyOption];
            xAxisDropdown.value = '';
            yAxisDropdown.options = [emptyOption];
            yAxisDropdown.value = '';

            // Add visual indication of disabled state via CSS class
            xAxisDropdown.classList.add('dropdown-disabled');
            yAxisDropdown.classList.add('dropdown-disabled');
            return;
        }

        // Remove disabled state when data is available
        xAxisDropdown.classList.remove('dropdown-disabled');
        yAxisDropdown.classList.remove('dropdown-disabled');

        const options = cols.map((c) => ({ value: c, label: c }));
        // Always offer synthetic index as an option for X
        xAxisDropdown.options = [{ value: 'index', label: 'index' }, ...options];
        if (!xAxisDropdown.value) xAxisDropdown.value = 'index';
        // Y options are all columns except the currently selected X (if present in list)
        const xVal = xAxisDropdown.value;
        const yOpts = options.filter((o) => o.value !== xVal);
        yAxisDropdown.options = yOpts.length ? yOpts : options;
        if (!yAxisDropdown.value) yAxisDropdown.value = yAxisDropdown.options[0]?.value ?? '';
    };

    const guessColumnsFromFile = (file: TDataFile | undefined | null): string[] | null => {
        if (!file || !file.text) return null;
        const linesRaw = file.text.split(/\r?\n/);
        const first = linesRaw.find((l) => l.trim().length > 0);
        if (!first) {
            return null;
        }
        const cells = first.split(/[\t,;:]/).map((s) => s.trim());
        if (cells.length === 0) return null;
        const isProbHeader = cells.some((s) => !/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(s));
        if (isProbHeader) {
            return cells.map((s, i) => (s.length ? s : 'col' + String(i + 1)));
        }
        // No clear header; infer generic names
        return cells.map((_s, i) => (i === 0 ? 'time' : 'col' + String(i + 1)));
    };

    const refreshAxisOptionsFromDataFiles = (files: TDataFile[] | undefined) => {
        const firstVisible = (files ?? []).find((f) => f.visible && typeof f.text === 'string');
        const cols = guessColumnsFromFile(firstVisible ?? null);
        setAxisOptions(cols);
    };

    // Initial seed from global if available
    const win = window as unknown as { __dataFiles?: TDataFile[] };
    if (Array.isArray(win.__dataFiles)) {
        refreshAxisOptionsFromDataFiles(win.__dataFiles);
    } else {
        setAxisOptions(null);
    }
    if (cfgXType) {
        cfgXType.options = [
            { value: 'index', label: 'Index (category)' },
            { value: 'time', label: 'Time (date/time)' },
            { value: 'numeric', label: 'Numeric (value axis)' },
        ];
        cfgXType.value = 'index';
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
    if (activeLabelDropdown) {
        // Initialize with empty state - will be populated from actual labels
        updateActiveLabelDropdown();
    }
    xAxisDropdown?.addEventListener('change', (ev: Event) => {
        const ce = ev as CustomEvent<{ value?: unknown }>;
        const val = typeof ce.detail.value === 'string' ? ce.detail.value : '';
        if (val) {
            (ev.currentTarget as HTMLElement).setAttribute('data-selected', val);
        }
    });
    yAxisDropdown?.addEventListener('change', (ev: Event) => {
        const ce = ev as CustomEvent<{ value?: unknown }>;
        const val = typeof ce.detail.value === 'string' ? ce.detail.value : '';
        if (val) {
            (ev.currentTarget as HTMLElement).setAttribute('data-selected', val);
        }
    });

    // Refresh options when uploaded files change
    window.addEventListener('timelab:dataFilesChanged', (ev) => {
        const detail = (ev as CustomEvent<{ files: TDataFile[] }>).detail;
        refreshAxisOptionsFromDataFiles(detail.files);
    });

    // Listen for direct column updates from the chart system
    window.addEventListener('timelab:columnsAvailable', (ev) => {
        const detail = (ev as CustomEvent<{ columns: string[] }>).detail;
        setAxisOptions(detail.columns.length > 0 ? detail.columns : null);
    });

    // Set up observer for labels list changes to update active label dropdown
    const labelsList = document.querySelector<HTMLUListElement>('.labels-list');
    if (labelsList) {
        const labelsObserver = new MutationObserver(() => {
            updateActiveLabelDropdown();
        });
        labelsObserver.observe(labelsList, { childList: true, subtree: true });
    }
}
