/**
 * Domain-specific error types for the TimeLab application
 */

export class TimeLabError extends Error {
    override name = 'TimeLabError';

    constructor(
        message: string,
        cause?: unknown
    ) {
        super(message);
        if (cause !== undefined) {
            this.cause = cause;
        }
    }
}

export class DataValidationError extends TimeLabError {
    override name = 'DataValidationError';
}

export class StorageError extends TimeLabError {
    override name = 'StorageError';
}

export class ChartError extends TimeLabError {
    override name = 'ChartError';
}

export class FileProcessingError extends TimeLabError {
    override name = 'FileProcessingError';
}
