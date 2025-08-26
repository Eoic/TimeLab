/**
 * Pure domain validators for time series data
 */

import type { TimeSeriesDataset, TimeSeriesValidationResult } from './timeSeries';

export function validateTimeSeriesDataset(dataset: unknown): TimeSeriesValidationResult {
    const errors: string[] = [];

    if (!dataset || typeof dataset !== 'object') {
        errors.push('Dataset must be an object');
        return { isValid: false, errors };
    }

    const data = dataset as Record<string, unknown>;

    if (!data.id || typeof data.id !== 'string') {
        errors.push('Dataset must have a valid string id');
    }

    if (!data.name || typeof data.name !== 'string') {
        errors.push('Dataset must have a valid string name');
    }

    if (!Array.isArray(data.data)) {
        errors.push('Dataset must have a data array');
    } else {
        const invalidPoints = data.data.filter((point) => {
            if (!point || typeof point !== 'object') return true;
            const p = point as Record<string, unknown>;
            return (
                typeof p.timestamp !== 'number' ||
                typeof p.value !== 'number' ||
                !Number.isFinite(p.timestamp) ||
                !Number.isFinite(p.value)
            );
        });

        if (invalidPoints.length > 0) {
            errors.push(`Dataset contains ${String(invalidPoints.length)} invalid data points`);
        }
    }

    if (!Array.isArray(data.labels)) {
        errors.push('Dataset must have a labels array');
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
}

export function isValidTimeSeriesDataset(dataset: unknown): dataset is TimeSeriesDataset {
    const result = validateTimeSeriesDataset(dataset);
    return result.isValid;
}
