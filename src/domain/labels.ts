/**
 * Domain types and logic for time-series labeling
 */

/**
 * A label applied to a specific time range in a dataset
 */
export interface TimeSeriesLabel {
    readonly id: string;
    readonly startTime: number;
    readonly endTime: number;
    readonly labelDefId: string;
    readonly datasetId: string;
    readonly createdAt: number;
    readonly updatedAt: number;
}

/**
 * Definition of a label type with name and color
 */
export interface LabelDefinition {
    readonly id: string;
    readonly name: string;
    readonly color: string;
    readonly createdAt: number;
    readonly updatedAt: number;
}

/**
 * Default label definitions for new installations
 */
export const DEFAULT_LABEL_DEFINITIONS: readonly LabelDefinition[] = [
    {
        id: 'normal',
        name: 'Normal',
        color: '#22c55e',
        createdAt: Date.now(),
        updatedAt: Date.now(),
    },
    {
        id: 'anomaly',
        name: 'Anomaly',
        color: '#ef4444',
        createdAt: Date.now(),
        updatedAt: Date.now(),
    },
    {
        id: 'event',
        name: 'Event',
        color: '#3b82f6',
        createdAt: Date.now(),
        updatedAt: Date.now(),
    },
] as const;

/**
 * Validation helpers
 */
export function isValidTimeRange(startTime: number, endTime: number): boolean {
    return Number.isFinite(startTime) && 
           Number.isFinite(endTime) && 
           startTime < endTime;
}

export function validateLabelDefinition(def: Partial<LabelDefinition>): string[] {
    const errors: string[] = [];
    
    if (!def.name || def.name.trim().length === 0) {
        errors.push('Name is required');
    }
    
    if (!def.color || !/^#[0-9a-fA-F]{6}$/.test(def.color)) {
        errors.push('Valid hex color is required');
    }
    
    return errors;
}

/**
 * Create a new label with generated ID and timestamps
 */
export function createTimeSeriesLabel(
    startTime: number, 
    endTime: number, 
    labelDefId: string, 
    datasetId: string
): TimeSeriesLabel {
    if (!isValidTimeRange(startTime, endTime)) {
        throw new Error('Invalid time range');
    }
    
    const now = Date.now();
    return {
        id: crypto.randomUUID(),
        startTime,
        endTime,
        labelDefId,
        datasetId,
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * Create a new label definition with generated ID and timestamps
 */
export function createLabelDefinition(name: string, color: string): LabelDefinition {
    const errors = validateLabelDefinition({ name, color });
    if (errors.length > 0) {
        throw new Error(`Invalid label definition: ${errors.join(', ')}`);
    }
    
    const now = Date.now();
    return {
        id: crypto.randomUUID(),
        name: name.trim(),
        color: color.toLowerCase(),
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * Convert hex color to rgba with alpha transparency
 */
export function hexToRgba(hex: string, alpha: number): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result || !result[1] || !result[2] || !result[3]) {
        return `rgba(0, 0, 0, ${alpha})`;
    }
    
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
