/**
 * CSV data processing and TimeSeriesData implementation
 */

import type { TimeSeriesData } from '../charts/timeSeries';
import type { TDataFile } from '../uploads';

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
    }

    getData(xColumn: string, yColumn: string): ReadonlyArray<readonly [number, number]> {
        const xIndex = this.columns.indexOf(xColumn);
        const yIndex = this.columns.indexOf(yColumn);

        if (xIndex === -1 || yIndex === -1) {
            return [];
        }

        return this.parsedData.map((row, index) => {
            const xValue = xIndex < row.length ? (row[xIndex] ?? index) : index;
            const yValue = yIndex < row.length ? (row[yIndex] ?? 0) : 0;
            return [xValue, yValue] as const;
        });
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
