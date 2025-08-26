/**
 * Shared barrel export for common utilities
 */

export type { Result, Ok, Err } from './result';
export { ok, err, isOk, isErr } from './result';

export {
    TimeLabError,
    DataValidationError,
    StorageError,
    ChartError,
    FileProcessingError,
} from './errors';
