/**
 * CSV data processing and TimeSeriesData implementation
 */

import type { TimeSeriesData } from '../charts/timeSeries';
import type { TimeSeriesLabel } from '../domain/labels';
import {
    getAllTimeSeriesLabels,
    saveTimeSeriesLabel,
    deleteTimeSeriesLabel,
} from '../platform/storage';
import type { TDataFile } from './uploads';

/**
 * Implementation of TimeSeriesData for CSV files
 */
export class CSVTimeSeriesData implements TimeSeriesData {
    public readonly id: string;
    public readonly name: string;
    public readonly columns: readonly string[];
    private parsedData: ReadonlyArray<readonly number[]> = [];
    private labeled = false;
    private sourceFile: TDataFile;
    private labels: TimeSeriesLabel[] = [];

    constructor(file: TDataFile) {
        this.id = file.id;
        this.name = file.name;
        this.sourceFile = file;

        // Parse CSV and extract columns and data
        const { columns, data } = parseCSV(file.text || '');
        this.columns = columns;
        this.parsedData = data;

        // Initialize labeled state from file data
        if (file.labeled) {
            this.labeled = file.labeled;
        } else {
            this.labeled = false;
        }

        // Load existing labels for this dataset, but wait for label definitions to be available
        this.waitForLabelDefinitionsAndLoadLabels();
    }

    getData(xColumn: string, yColumn: string): ReadonlyArray<readonly [number, number]> {
        // Handle special case for "index" - use row index instead of column data
        const useXIndex = xColumn === 'index';
        const useYIndex = yColumn === 'index';

        const xIndex = useXIndex ? -1 : this.columns.indexOf(xColumn);
        const yIndex = useYIndex ? -1 : this.columns.indexOf(yColumn);

        // Check if non-index columns exist
        if (!useXIndex && xIndex === -1) {
            return [];
        }
        if (!useYIndex && yIndex === -1) {
            return [];
        }

        const result = this.parsedData.map((row, index) => {
            // For x-axis: use row index if "index" selected, otherwise use column data
            const xValue = useXIndex ? index : xIndex < row.length ? (row[xIndex] ?? index) : index;

            // For y-axis: use row index if "index" selected, otherwise use column data
            const yValue = useYIndex ? index : yIndex < row.length ? (row[yIndex] ?? 0) : 0;

            return [xValue, yValue] as const;
        });

        // Sort data by X values for proper line rendering and area filling
        // Only sort when not using index for X-axis (index is already sorted)
        const sortedResult = useXIndex ? result : result.slice().sort((a, b) => a[0] - b[0]);

        return sortedResult;
    }

    isLabeled(): boolean {
        return this.labeled;
    }

    setLabeled(labeled: boolean): void {
        this.labeled = labeled;

        // Update the source file
        this.sourceFile.labeled = labeled;

        // Trigger an update to refresh global data files array
        // The uploads system will handle persistence
        const event = new CustomEvent('timelab:labeledStateChanged', {
            detail: { fileId: this.sourceFile.id, labeled },
        });
        window.dispatchEvent(event);
    }

    getLabels(): ReadonlyArray<TimeSeriesLabel> {
        return [...this.labels];
    }

    addLabel(label: TimeSeriesLabel): void {
        this.labels.push(label);
        // Save to storage
        void this.saveLabelToStorage(label);
        this.notifyLabelsChanged();
    }

    removeLabel(labelId: string): void {
        const index = this.labels.findIndex((label) => label.id === labelId);
        if (index >= 0) {
            this.labels.splice(index, 1);
            // Remove from storage
            void this.removeLabelFromStorage(labelId);
            this.notifyLabelsChanged();
        }
    }

    toggleLabelVisibility(labelId: string): void {
        const index = this.labels.findIndex((label) => label.id === labelId);
        if (index >= 0 && this.labels[index]) {
            const existingLabel = this.labels[index];
            const updatedLabel: TimeSeriesLabel = {
                ...existingLabel,
                visible: existingLabel.visible !== false ? false : true, // Toggle: undefined/true → false, false → true
                updatedAt: Date.now(),
            };
            this.labels[index] = updatedLabel;
            // Update in storage
            void this.saveLabelToStorage(updatedLabel);
            this.notifyLabelsChanged();
        }
    }

    updateLabel(
        labelId: string,
        updates: Partial<Omit<TimeSeriesLabel, 'id' | 'datasetId' | 'createdAt'>>
    ): void {
        const index = this.labels.findIndex((label) => label.id === labelId);
        if (index >= 0 && this.labels[index]) {
            const existingLabel = this.labels[index];
            const updatedLabel: TimeSeriesLabel = {
                id: existingLabel.id,
                datasetId: existingLabel.datasetId,
                createdAt: existingLabel.createdAt,
                startTime: updates.startTime ?? existingLabel.startTime,
                endTime: updates.endTime ?? existingLabel.endTime,
                labelDefId: updates.labelDefId ?? existingLabel.labelDefId,
                updatedAt: Date.now(),
                ...(updates.visible !== undefined
                    ? { visible: updates.visible }
                    : existingLabel.visible !== undefined
                      ? { visible: existingLabel.visible }
                      : {}),
            };
            this.labels[index] = updatedLabel;
            // Update in storage
            void this.saveLabelToStorage(updatedLabel);
            this.notifyLabelsChanged();
        }
    }

    /**
     * Wait for label definitions to be loaded, then load labels for this dataset
     */
    private waitForLabelDefinitionsAndLoadLabels(): void {
        // Import the function dynamically to avoid circular dependencies
        import('../ui/dropdowns')
            .then(({ getLabelDefinitions }) => {
                const currentDefinitions = getLabelDefinitions();

                if (currentDefinitions.length > 0) {
                    // Definitions are already loaded, proceed immediately
                    void this.loadLabelsFromStorage();
                } else {
                    // Wait for label definitions to be loaded
                    const handleDefinitionsLoaded = (): void => {
                        window.removeEventListener(
                            'timelab:labelDefinitionsLoaded',
                            handleDefinitionsLoaded
                        );
                        void this.loadLabelsFromStorage();
                    };
                    window.addEventListener(
                        'timelab:labelDefinitionsLoaded',
                        handleDefinitionsLoaded
                    );
                }
            })
            .catch((error: unknown) => {
                // eslint-disable-next-line no-console
                console.error('Failed to import dropdowns module:', error);
                // Fallback: just load labels anyway
                void this.loadLabelsFromStorage();
            });
    }

    /**
     * Load labels for this dataset from IndexedDB
     */
    private async loadLabelsFromStorage(): Promise<void> {
        try {
            // Get all stored time series labels
            const result = await getAllTimeSeriesLabels();
            if (result.ok) {
                // Filter labels for this dataset
                const datasetLabels = (result.value as unknown as TimeSeriesLabel[]).filter(
                    (label) => label.datasetId === this.id
                );
                this.labels = datasetLabels;

                // Only notify if we have labels and if label definitions are available
                // This prevents showing labels with IDs instead of names during page reload
                if (datasetLabels.length > 0) {
                    this.notifyLabelsChangedIfDefinitionsReady();
                }
            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.warn('Failed to load labels from storage:', error);
        }
    }

    /**
     * Save a label to IndexedDB
     */
    private async saveLabelToStorage(label: TimeSeriesLabel): Promise<void> {
        try {
            // Convert label to a compatible record format
            const labelRecord = {
                id: label.id,
                startTime: label.startTime,
                endTime: label.endTime,
                labelDefId: label.labelDefId,
                datasetId: label.datasetId,
                createdAt: label.createdAt,
                updatedAt: label.updatedAt,
                visible: label.visible, // Include visibility state
            };
            const result = await saveTimeSeriesLabel(labelRecord);
            if (!result.ok) {
                // eslint-disable-next-line no-console
                console.warn('Failed to save label to storage:', result.error);
            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.warn('Error saving label to storage:', error);
        }
    }

    /**
     * Remove a label from IndexedDB
     */
    private async removeLabelFromStorage(labelId: string): Promise<void> {
        try {
            const result = await deleteTimeSeriesLabel(labelId);
            if (!result.ok) {
                // eslint-disable-next-line no-console
                console.warn('Failed to remove label from storage:', result.error);
            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.warn('Error removing label from storage:', error);
        }
    }

    private notifyLabelsChanged(): void {
        const event = new CustomEvent('timelab:labelsChanged', {
            detail: { datasetId: this.id, labels: this.getLabels() },
        });
        window.dispatchEvent(event);
    }

    /**
     * Notify labels changed only if label definitions are ready
     * This prevents labels from showing IDs instead of names during page reload
     */
    private notifyLabelsChangedIfDefinitionsReady(): void {
        // Import the function dynamically to avoid circular dependencies
        import('../ui/dropdowns')
            .then(({ getLabelDefinitions }) => {
                const currentDefinitions = getLabelDefinitions();

                if (currentDefinitions.length > 0) {
                    // Definitions are ready, safe to notify
                    this.notifyLabelsChanged();
                } else {
                    // Wait for label definitions to be loaded, then notify
                    const handleDefinitionsLoaded = (): void => {
                        window.removeEventListener(
                            'timelab:labelDefinitionsLoaded',
                            handleDefinitionsLoaded
                        );
                        this.notifyLabelsChanged();
                    };
                    window.addEventListener(
                        'timelab:labelDefinitionsLoaded',
                        handleDefinitionsLoaded
                    );
                }
            })
            .catch((error: unknown) => {
                // eslint-disable-next-line no-console
                console.error('Failed to import dropdowns module:', error);
                // Fallback: notify anyway (better than no notification)
                this.notifyLabelsChanged();
            });
    }
}

/**
 * Parse numeric value supporting both US (dot) and European (comma) decimal separators
 */
function parseNumericValue(value: string): number {
    if (!value || value.trim().length === 0) {
        return NaN;
    }

    const trimmed = value.trim();

    // Check if it might be European format (contains comma but no dot)
    if (trimmed.includes(',') && !trimmed.includes('.')) {
        // European format - replace comma with dot (1,234 -> 1.234)
        const europeanConverted = trimmed.replace(',', '.');
        const result = parseFloat(europeanConverted);
        if (Number.isFinite(result)) {
            return result;
        }
    }

    // Try standard parseFloat for US format (1.234) or if European conversion failed
    const result = parseFloat(trimmed);
    return result;
}

/**
 * Parse CSV text into columns and numeric data
 */
type ParsedCSV = {
    readonly columns: readonly string[];
    readonly data: ReadonlyArray<readonly number[]>;
};

function parseCSV(text: string): ParsedCSV {
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);

    if (lines.length === 0) {
        return { columns: [], data: [] };
    }

    // Get first line safely
    const firstLine = lines[0];
    if (!firstLine) {
        return { columns: [], data: [] };
    }

    // Detect delimiter
    const delimiter = detectDelimiter(firstLine);

    // Parse first line to determine if it's a header
    const firstLineCells = firstLine.split(delimiter).map((cell) => cell.trim());
    const hasHeader = detectHeader(firstLineCells);

    let columns: string[];
    let dataStartIndex: number;

    if (hasHeader) {
        columns = firstLineCells.map((col, i) => (col.length > 0 ? col : `col${String(i + 1)}`));
        dataStartIndex = 1;
    } else {
        columns = firstLineCells.map((_, i) => `col${String(i + 1)}`);
        dataStartIndex = 0;
    }

    // Parse numeric data
    const data: number[][] = [];
    for (let i = dataStartIndex; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        const cells = line.split(delimiter).map((cell) => cell.trim());
        const row: number[] = [];

        for (let j = 0; j < columns.length; j++) {
            const cellValue = j < cells.length ? (cells[j] ?? '') : '';
            const numValue = parseNumericValue(cellValue);

            // If not a valid number, use index for x-axis or 0 for y-axis
            if (Number.isFinite(numValue)) {
                row.push(numValue);
            } else {
                // For time-like columns, try to parse as timestamp
                const timeValue = tryParseTime(cellValue);
                row.push(Number.isFinite(timeValue) ? timeValue : j === 0 ? i - dataStartIndex : 0);
            }
        }

        data.push(row);
    }

    return { columns, data };
}

/**
 * Detect CSV delimiter
 */
function detectDelimiter(line: string): string {
    const delimiters = [',', '\t', ';', '|'];
    let maxCount = 0;
    let bestDelimiter = ',';

    for (const delimiter of delimiters) {
        const count = line.split(delimiter).length - 1;
        if (count > maxCount) {
            maxCount = count;
            bestDelimiter = delimiter;
        }
    }

    return bestDelimiter;
}

/**
 * Detect if first line is a header
 */
function detectHeader(cells: string[]): boolean {
    // If any cell contains non-numeric content, assume it's a header
    return cells.some((cell) => {
        const trimmed = cell.trim();
        if (trimmed.length === 0) return false;

        // Check if it's a number (with European number format support)
        const num = parseNumericValue(trimmed);
        if (Number.isFinite(num)) return false;

        // Check if it's a timestamp
        const timeValue = tryParseTime(trimmed);
        return !Number.isFinite(timeValue);
    });
}

/**
 * Try to parse various time formats
 */
function tryParseTime(value: string): number {
    if (!value || value.trim().length === 0) {
        return NaN;
    }

    // Try ISO format
    const isoTime = Date.parse(value);
    if (Number.isFinite(isoTime)) {
        return isoTime;
    }

    // Try Unix timestamp (seconds)
    const unixSeconds = parseFloat(value);
    if (Number.isFinite(unixSeconds) && unixSeconds > 1000000000 && unixSeconds < 10000000000) {
        return unixSeconds * 1000; // Convert to milliseconds
    }

    // Try Unix timestamp (milliseconds)
    if (Number.isFinite(unixSeconds) && unixSeconds > 1000000000000) {
        return unixSeconds;
    }

    return NaN;
}

/**
 * Convert uploaded data files to TimeSeriesData array
 */
export function convertDataFilesToTimeSeries(files: TDataFile[]): ReadonlyArray<TimeSeriesData> {
    return files
        .filter((file) => file.visible && file.text && file.text.trim().length > 0)
        .map((file) => new CSVTimeSeriesData(file));
}
