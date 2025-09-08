/**
 * Common utility types for enhanced type safety and code clarity
 */

/**
 * Branded types for type-safe ID handling
 */
declare const __brand: unique symbol;
type Brand<T, TBrand> = T & { readonly [__brand]: TBrand };

// Branded ID types for different entities
export type ProjectId = Brand<string, 'ProjectId'>;
export type LabelDefinitionId = Brand<string, 'LabelDefinitionId'>;
export type TimeSeriesLabelId = Brand<string, 'TimeSeriesLabelId'>;
export type DataSourceId = Brand<string, 'DataSourceId'>;
export type ChartId = Brand<string, 'ChartId'>;

// Type guards for branded types
export function isProjectId(value: string): value is ProjectId {
    return typeof value === 'string' && value.length > 0;
}

export function isLabelDefinitionId(value: string): value is LabelDefinitionId {
    return typeof value === 'string' && value.length > 0;
}

export function isTimeSeriesLabelId(value: string): value is TimeSeriesLabelId {
    return typeof value === 'string' && value.length > 0;
}

export function isDataSourceId(value: string): value is DataSourceId {
    return typeof value === 'string' && value.length > 0;
}

export function isChartId(value: string): value is ChartId {
    return typeof value === 'string' && value.length > 0;
}

// Factory functions for creating branded IDs
export function createProjectId(value: string): ProjectId {
    if (!isProjectId(value)) {
        throw new Error('Invalid project ID format');
    }
    return value;
}

export function createLabelDefinitionId(value: string): LabelDefinitionId {
    if (!isLabelDefinitionId(value)) {
        throw new Error('Invalid label definition ID format');
    }
    return value;
}

export function createTimeSeriesLabelId(value: string): TimeSeriesLabelId {
    if (!isTimeSeriesLabelId(value)) {
        throw new Error('Invalid time series label ID format');
    }
    return value;
}

export function createDataSourceId(value: string): DataSourceId {
    if (!isDataSourceId(value)) {
        throw new Error('Invalid data source ID format');
    }
    return value;
}

export function createChartId(value: string): ChartId {
    if (!isChartId(value)) {
        throw new Error('Invalid chart ID format');
    }
    return value;
}

/**
 * Common utility types for enhanced type manipulation
 */

// Make all properties of T optional except for K
export type PartialExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>;

// Make specific properties of T required
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Extract function parameters as tuple
export type Parameters<T extends (...args: unknown[]) => unknown> = T extends (
    ...args: infer P
) => unknown
    ? P
    : never;

// Extract function return type
export type ReturnType<T extends (...args: unknown[]) => unknown> = T extends (
    ...args: unknown[]
) => infer R
    ? R
    : unknown;

// Create a type with all properties of T as readonly deeply
export type DeepReadonly<T> = {
    readonly [P in keyof T]: T[P] extends (infer U)[]
        ? ReadonlyArray<DeepReadonly<U>>
        : T[P] extends readonly (infer U)[]
          ? ReadonlyArray<DeepReadonly<U>>
          : T[P] extends object
            ? DeepReadonly<T[P]>
            : T[P];
};

// Create a type with all properties of T as mutable (opposite of readonly)
export type Mutable<T> = {
    -readonly [P in keyof T]: T[P];
};

// Deep mutable version
export type DeepMutable<T> = {
    -readonly [P in keyof T]: T[P] extends (infer U)[]
        ? Array<DeepMutable<U>>
        : T[P] extends readonly (infer U)[]
          ? Array<DeepMutable<U>>
          : T[P] extends object
            ? DeepMutable<T[P]>
            : T[P];
};

// Exclude null and undefined from T
export type NonNullable<T> = T extends null | undefined ? never : T;

// Get the value type of an object
export type ValueOf<T> = T[keyof T];

// Create union type from array values
export type ArrayElement<ArrayType extends readonly unknown[]> =
    ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

// Conditional type for optional vs required properties
export type OptionalKeys<T> = {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

export type RequiredPropKeys<T> = {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

// Create a type where some keys are optional
export type WithOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Create a type where some keys are required
export type WithRequired<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Event system utility types
 */

// Generic event emitter interface
export interface EventEmitter<TEvents extends Record<string, unknown>> {
    on<K extends keyof TEvents>(event: K, listener: (data: TEvents[K]) => void): () => void;
    off<K extends keyof TEvents>(event: K, listener: (data: TEvents[K]) => void): void;
    emit<K extends keyof TEvents>(event: K, data: TEvents[K]): void;
}

// Event listener type
export type EventListener<T> = (event: T) => void;

// Event handler map type
export type EventHandlerMap<TEvents extends Record<string, unknown>> = {
    [K in keyof TEvents]?: Array<EventListener<TEvents[K]>>;
};

/**
 * Configuration and options utility types
 */

// Configuration with defaults
export type ConfigWithDefaults<TConfig, TDefaults extends Partial<TConfig>> = TConfig & {
    readonly [K in keyof TDefaults]-?: NonNullable<TDefaults[K]>;
};

// Options type for functions
export type Options<T> = {
    readonly [K in keyof T]?: T[K];
};

// Merge two types with the second overriding the first
export type Merge<T, U> = Omit<T, keyof U> & U;

// Deep merge utility type
export type DeepMerge<T, U> = T extends object
    ? U extends object
        ? {
              [K in keyof T | keyof U]: K extends keyof U
                  ? K extends keyof T
                      ? DeepMerge<T[K], U[K]>
                      : U[K]
                  : K extends keyof T
                    ? T[K]
                    : never;
          }
        : U
    : U;

/**
 * API and service utility types
 */

// Service method types
export type ServiceMethod<TArgs extends readonly unknown[], TReturn> = (
    ...args: TArgs
) => Promise<TReturn>;

// Service interface from implementation
export type ServiceInterface<T> = {
    [K in keyof T]: T[K] extends (...args: infer A) => infer R ? (...args: A) => R : T[K];
};

// Extract service methods only
export type ServiceMethods<T> = {
    [K in keyof T]: T[K] extends (...args: unknown[]) => unknown ? T[K] : never;
};

// Async version of service methods
export type AsyncServiceMethods<T> = {
    [K in keyof ServiceMethods<T>]: ServiceMethods<T>[K] extends (...args: infer A) => infer R
        ? (...args: A) => Promise<R>
        : never;
};

/**
 * Data validation utility types
 */

// Schema validation result
export type ValidationResult<T> =
    | { readonly success: true; readonly data: T }
    | { readonly success: false; readonly errors: readonly string[] };

// Validator function type
export type Validator<T> = (value: unknown) => ValidationResult<T>;

// Schema type for object validation
export type Schema<T> = {
    readonly [K in keyof T]: Validator<T[K]>;
};

/**
 * Component and UI utility types
 */

// Component props with children (generic version)
export type PropsWithChildren<T = Record<string, never>> = T & {
    readonly children?: unknown; // Use unknown instead of React.ReactNode for framework agnostic
};

// Component ref type (generic version)
export type ComponentRef<T extends HTMLElement = HTMLElement> = { current: T | null };

// Event handler types for common DOM events
export type ClickHandler = (event: MouseEvent) => void;
export type KeyboardHandler = (event: KeyboardEvent) => void;
export type ChangeHandler = (event: Event) => void;
export type InputHandler = (event: InputEvent) => void;

// CSS class names utility
export type ClassName = string | undefined | null | false;
export type ClassNameValue = ClassName | ClassName[];

/**
 * Storage and persistence utility types
 */

// Storage key with type information
export type StorageKey<T> = Brand<string, 'StorageKey'> & {
    readonly _valueType: T;
};

// Create typed storage key
export function createStorageKey<T>(key: string): StorageKey<T> {
    return key as StorageKey<T>;
}

// Storage operations result
export type StorageOperation<T> =
    | { readonly success: true; readonly value: T }
    | { readonly success: false; readonly error: string };

/**
 * Time and date utility types
 */

// Timestamp in milliseconds
export type Timestamp = Brand<number, 'Timestamp'>;

// Duration in milliseconds
export type Duration = Brand<number, 'Duration'>;

// ISO date string
export type ISODateString = Brand<string, 'ISODateString'>;

// Time zone identifier
export type TimeZone = Brand<string, 'TimeZone'>;

// Factory functions for time types
export function createTimestamp(value: number): Timestamp {
    return value as Timestamp;
}

export function createDuration(milliseconds: number): Duration {
    return milliseconds as Duration;
}

export function createISODateString(value: string): ISODateString {
    // Basic ISO date validation
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
        throw new Error('Invalid ISO date string format');
    }
    return value as ISODateString;
}

export function createTimeZone(value: string): TimeZone {
    return value as TimeZone;
}

/**
 * Math and number utility types
 */

// Positive number
export type PositiveNumber = Brand<number, 'PositiveNumber'>;

// Non-negative number (includes 0)
export type NonNegativeNumber = Brand<number, 'NonNegativeNumber'>;

// Percentage (0-100)
export type Percentage = Brand<number, 'Percentage'>;

// Decimal (0-1)
export type Decimal = Brand<number, 'Decimal'>;

// Factory functions for number types
export function createPositiveNumber(value: number): PositiveNumber {
    if (value <= 0) {
        throw new Error('Value must be positive');
    }
    return value as PositiveNumber;
}

export function createNonNegativeNumber(value: number): NonNegativeNumber {
    if (value < 0) {
        throw new Error('Value must be non-negative');
    }
    return value as NonNegativeNumber;
}

export function createPercentage(value: number): Percentage {
    if (value < 0 || value > 100) {
        throw new Error('Percentage must be between 0 and 100');
    }
    return value as Percentage;
}

export function createDecimal(value: number): Decimal {
    if (value < 0 || value > 1) {
        throw new Error('Decimal must be between 0 and 1');
    }
    return value as Decimal;
}
