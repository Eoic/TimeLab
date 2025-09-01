/**
 * Domain barrel export
 */

export type {
    TimeSeriesPoint,
    TimeSeriesLabel,
    TimeSeriesSelection,
    TimeSeriesDataset,
    TimeSeriesState,
    TimeSeriesValidationResult,
} from './timeSeries';

export { validateTimeSeriesDataset, isValidTimeSeriesDataset } from './validators';

// Label-related exports
export { 
    createTimeSeriesLabel, 
    createLabelDefinition, 
    isValidTimeRange, 
    validateLabelDefinition,
    hexToRgba,
    DEFAULT_LABEL_DEFINITIONS,
} from './labels';
export type { TimeSeriesLabel as Label, LabelDefinition } from './labels';
