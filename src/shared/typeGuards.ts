/**
 * Common type guards and utility functions for type safety
 * Helps eliminate unsafe type assertions throughout the codebase
 */

/**
 * Check if value is defined (not null or undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
    return value !== null && value !== undefined;
}

/**
 * Check if value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0;
}

/**
 * Check if value is a valid number (not NaN)
 */
export function isValidNumber(value: unknown): value is number {
    return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Check if value is a valid integer
 */
export function isValidInteger(value: unknown): value is number {
    return isValidNumber(value) && Number.isInteger(value);
}

/**
 * Check if value is a positive number
 */
export function isPositiveNumber(value: unknown): value is number {
    return isValidNumber(value) && value > 0;
}

/**
 * Check if value is a non-negative number (>= 0)
 */
export function isNonNegativeNumber(value: unknown): value is number {
    return isValidNumber(value) && value >= 0;
}

/**
 * Check if value is a valid timestamp (positive number)
 */
export function isValidTimestamp(value: unknown): value is number {
    return isValidNumber(value) && value > 0 && Number.isInteger(value);
}

/**
 * Check if object has all required keys
 */
export function hasRequiredKeys<T extends Record<string, unknown>>(
    obj: unknown,
    keys: (keyof T)[]
): obj is T {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }

    const record = obj as Record<string, unknown>;
    return keys.every((key) => {
        const stringKey = String(key);
        return stringKey in record && record[stringKey] !== undefined;
    });
}

/**
 * Safe object property access with type guard
 */
export function getProperty<T, K extends keyof T>(
    obj: T,
    key: K,
    guard: (value: unknown) => value is T[K]
): T[K] | undefined {
    const value = obj[key];
    return guard(value) ? value : undefined;
}

/**
 * Safe array element access with bounds checking
 */
export function safeArrayAccess<T>(array: T[], index: number): T | undefined {
    return index >= 0 && index < array.length ? array[index] : undefined;
}

/**
 * Check if value is a valid array of specific type
 */
export function isArrayOf<T>(
    value: unknown,
    itemGuard: (item: unknown) => item is T
): value is T[] {
    return Array.isArray(value) && value.every(itemGuard);
}

/**
 * Safe JSON parsing with error handling
 */
export function safeJsonParse<T>(json: string, guard: (value: unknown) => value is T): T | null {
    try {
        const parsed = JSON.parse(json);
        return guard(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

/**
 * Check if value is a valid object (not null, not array)
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        Object.prototype.toString.call(value) === '[object Object]'
    );
}

/**
 * Create a type assertion function that throws if the check fails
 */
export function assertType<T>(
    value: unknown,
    guard: (value: unknown) => value is T,
    message?: string
): asserts value is T {
    if (!guard(value)) {
        throw new Error(message || 'Type assertion failed');
    }
}

/**
 * Safe function that returns default value if input fails type guard
 */
export function withDefault<T>(
    value: unknown,
    guard: (value: unknown) => value is T,
    defaultValue: T
): T {
    return guard(value) ? value : defaultValue;
}

/**
 * Check if value is a valid HTML element
 */
export function isHTMLElement(value: unknown): value is HTMLElement {
    return value instanceof HTMLElement;
}

/**
 * Check if value is a valid Canvas element
 */
export function isCanvasElement(value: unknown): value is HTMLCanvasElement {
    return value instanceof HTMLCanvasElement;
}

/**
 * Check if value looks like an event object
 */
export function isEventLike(value: unknown): value is Event {
    return typeof value === 'object' && value !== null && 'type' in value && 'target' in value;
}

/**
 * Check if value is a function
 */
export function isFunction(value: unknown): value is Function {
    return typeof value === 'function';
}

/**
 * Narrow union type based on discriminant property
 */
export function hasDiscriminant<T extends Record<K, V>, K extends keyof T, V extends T[K]>(
    obj: T,
    key: K,
    value: V
): obj is T & Record<K, V> {
    return obj[key] === value;
}

/**
 * Safe conversion to number with fallback
 */
export function toNumberSafe(value: unknown, fallback = 0): number {
    if (isValidNumber(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = Number(value);
        return isValidNumber(parsed) ? parsed : fallback;
    }
    return fallback;
}

/**
 * Safe conversion to string
 */
export function toStringSafe(value: unknown): string {
    if (typeof value === 'string') {
        return value;
    }
    if (value === null || value === undefined) {
        return '';
    }
    try {
        return String(value);
    } catch {
        return '';
    }
}
