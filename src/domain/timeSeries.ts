/**
 * Pure domain types for time series data - no dependencies on UI or storage
 */

export interface TimeSeriesPoint {
    readonly timestamp: number;
    readonly value: number;
}

export interface TimeSeriesLabel {
    readonly id: string;
    readonly name: string;
    readonly startTime: number;
    readonly endTime: number;
    readonly color: string;
}

export interface TimeSeriesSelection {
    readonly startTime: number;
    readonly endTime: number;
}

export interface TimeSeriesDataset {
    readonly id: string;
    readonly name: string;
    readonly data: readonly TimeSeriesPoint[];
    readonly labels: readonly TimeSeriesLabel[];
}

export type TimeSeriesState =
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'loaded'; dataset: TimeSeriesDataset }
    | { kind: 'error'; error: Error };

export interface TimeSeriesValidationResult {
    readonly isValid: boolean;
    readonly errors: readonly string[];
}
