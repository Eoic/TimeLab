import { getLabelService } from '../services/labelService';

import type { TDataFile } from '@/data/uploads';
import { DEFAULT_LABEL_DEFINITIONS } from '@/domain/labels';
import { getAllLabels, saveLabel } from '@/platform';
import { uuid } from '@/shared/misc';
import type { LabelDefinition } from '@/types/storage';
import type { TLDropdown } from '@/ui/dropdown';

/**
 * In-memory cache of label definitions
 */
const labelDefinitions: LabelDefinition[] = [];
let isLoaded = false;

/**
 * Global observer for cleanup
 */
let labelsObserver: MutationObserver | null = null;

/**
 * Load label definitions from IndexedDB
 */
export async function loadLabelDefinitions(): Promise<void> {
    if (isLoaded) return;

    try {
        const result = await getAllLabels<LabelDefinition>();
        if (result.ok) {
            // Clear current definitions and populate from storage
            labelDefinitions.length = 0;
            labelDefinitions.push(...result.value);

            // If no definitions exist, create defaults
            if (labelDefinitions.length === 0) {
                await createDefaultDefinitions();
            }

            updateActiveLabelDropdown();

            // Dispatch an event that label definitions have been loaded
            // This allows other components (like LabelsPanel) to refresh their display
            window.dispatchEvent(new CustomEvent('timelab:labelDefinitionsLoaded'));
        } else {
            // eslint-disable-next-line no-console
            console.error('Failed to load label definitions:', result.error);
        }
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error loading label definitions:', error);
    }

    isLoaded = true;
}

/**
 * Create default label definitions if none exist
 */
async function createDefaultDefinitions(): Promise<void> {
    for (const defaultDef of DEFAULT_LABEL_DEFINITIONS) {
        const labelDef: LabelDefinition = {
            id: defaultDef.id,
            name: defaultDef.name,
            color: defaultDef.color,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        try {
            const result = await saveLabel(labelDef);
            if (result.ok) {
                labelDefinitions.push(labelDef);
            } else {
                // eslint-disable-next-line no-console
                console.error('Failed to save default label definition:', result.error);
            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Error saving default label definition:', error);
        }
    }

    updateActiveLabelDropdown();

    // Dispatch an event that label definitions have been created/loaded
    window.dispatchEvent(new CustomEvent('timelab:labelDefinitionsLoaded'));
}

/**
 * Save a specific label definition object to IndexedDB (preserves the UUID)
 */
async function saveLabelDefinitionToDBWithId(labelDef: LabelDefinition): Promise<void> {
    try {
        const result = await saveLabel(labelDef);
        if (!result.ok) {
            // eslint-disable-next-line no-console
            console.error('Failed to save label definition:', result.error);
        }
    } catch (error: unknown) {
        // eslint-disable-next-line no-console
        console.error('Error saving label definition:', error);
    }
}

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

    // Create options from label definitions using UUIDs as values
    const options = labelDefinitions.map((def) => ({
        value: def.id, // Use UUID instead of index
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
    void loadLabelDefinitions(); // Ensure loaded

    // Create the full label definition
    const labelDef: LabelDefinition = {
        id: uuid(),
        name,
        color,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };

    // Add to memory
    labelDefinitions.push(labelDef);

    // Save the SAME definition to database (not create a new one with different UUID)
    void saveLabelDefinitionToDBWithId(labelDef);

    updateActiveLabelDropdown();

    // Auto-select the newly created label definition as active
    const activeLabelDropdown = document.querySelector<TLDropdown>('#active-label');
    if (activeLabelDropdown) {
        activeLabelDropdown.value = labelDef.id;
    }

    // Dispatch an event that label definitions have been updated
    window.dispatchEvent(new CustomEvent('timelab:labelDefinitionsLoaded'));
}

/**
 * Get all label definitions
 * Ensures definitions are loaded before returning
 */
export async function getLabelDefinitionsAsync(): Promise<LabelDefinition[]> {
    if (!isLoaded) {
        await loadLabelDefinitions();
    }
    return [...labelDefinitions]; // Return a copy to prevent direct mutation
}

/**
 * Get all label definitions (synchronous version for backward compatibility)
 * Will attempt to load if not loaded, but returns immediately
 */
export function getLabelDefinitions(): LabelDefinition[] {
    // If not loaded yet, try to load definitions synchronously if possible
    if (!isLoaded) {
        // Trigger async loading for next time, but for now return what we have
        void loadLabelDefinitions();
    }
    return [...labelDefinitions]; // Return a copy to prevent direct mutation
}

/**
 * Update an existing label definition
 */
export function updateLabelDefinition(index: number, name: string, color: string): void {
    if (index >= 0 && index < labelDefinitions.length) {
        const existing = labelDefinitions[index];
        if (existing) {
            // Update the existing definition in memory
            existing.name = name;
            existing.color = color;
            existing.updatedAt = Date.now();

            // Use LabelService for cascading updates to related TimeSeriesLabels
            const labelService = getLabelService();
            void labelService.updateLabelDefinition(existing.id, { name, color });
        }

        updateActiveLabelDropdown();

        // Dispatch an event that label definitions have been updated
        window.dispatchEvent(new CustomEvent('timelab:labelDefinitionsLoaded'));
    }
}

/**
 * Delete a label definition
 */
export function deleteLabelDefinition(index: number): void {
    if (index >= 0 && index < labelDefinitions.length) {
        const definition = labelDefinitions[index];
        if (definition) {
            // Remove from memory
            labelDefinitions.splice(index, 1);

            // Use LabelService for cascading deletion of related TimeSeriesLabels
            const labelService = getLabelService();
            void labelService.deleteLabelDefinition(definition.id);

            updateActiveLabelDropdown();

            // Dispatch an event that label definitions have been updated
            window.dispatchEvent(new CustomEvent('timelab:labelDefinitionsLoaded'));
        }
    }
}

export function setupDropdowns(): void {
    // Load label definitions from IndexedDB on startup
    void loadLabelDefinitions();

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

        // Auto-select good defaults for the CSV file
        if (!xAxisDropdown.value) {
            // Try to find a time-like column first (e.g., "Winkel" for angle)
            const timeColumn = cols.find(
                (col) =>
                    col.toLowerCase().includes('time') ||
                    col.toLowerCase().includes('winkel') ||
                    col.toLowerCase().includes('angle') ||
                    col.toLowerCase().includes('index')
            );
            xAxisDropdown.value = timeColumn || 'index';
        }

        // Y options are all columns (same as X options)
        yAxisDropdown.options = options;

        if (!yAxisDropdown.value) {
            const yColumn = options.find(
                (opt) =>
                    opt.value.toLowerCase().includes('punch') ||
                    opt.value.toLowerCase().includes('force') ||
                    opt.value.toLowerCase().includes('value') ||
                    opt.value.toLowerCase().includes('signal')
            );
            yAxisDropdown.value = yColumn?.value || yAxisDropdown.options[0]?.value || '';
        }

        // Trigger chart update after setting defaults
        setTimeout(() => {
            const updateEvent = new CustomEvent('timelab:axisOptionsUpdated', {
                detail: { xColumn: xAxisDropdown.value, yColumn: yAxisDropdown.value },
            });
            window.dispatchEvent(updateEvent);
        }, 50);
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
            { value: 'numeric', label: 'Numeric (value axis)' },
            { value: 'time', label: 'Time (date/time)' },
            { value: 'index', label: 'Index (category)' },
        ];
        cfgXType.value = 'numeric'; // Default to numeric for all columns
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
        // Clean up existing observer if any
        if (labelsObserver) {
            labelsObserver.disconnect();
        }

        labelsObserver = new MutationObserver(() => {
            updateActiveLabelDropdown();
        });

        labelsObserver.observe(labelsList, { childList: true, subtree: true });
    }
}

/**
 * Clean up resources to prevent memory leaks
 */
export function destroyDropdowns(): void {
    if (labelsObserver) {
        labelsObserver.disconnect();
        labelsObserver = null;
    }
}
