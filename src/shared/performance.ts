/**
 * Performance optimization utilities including memoization and caching
 */

/**
 * Simple LRU cache implementation for memoization
 */
export class LRUCache<K, V> {
    private readonly maxSize: number;
    private readonly cache = new Map<K, V>();

    constructor(maxSize = 100) {
        this.maxSize = maxSize;
    }

    get(key: K): V | undefined {
        const value = this.cache.get(key);
        if (value !== undefined) {
            // Move to end (most recently used)
            this.cache.delete(key);
            this.cache.set(key, value);
        }
        return value;
    }

    set(key: K, value: V): void {
        if (this.cache.has(key)) {
            // Update existing key
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            // Remove least recently used
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
            }
        }
        this.cache.set(key, value);
    }

    has(key: K): boolean {
        return this.cache.has(key);
    }

    clear(): void {
        this.cache.clear();
    }

    get size(): number {
        return this.cache.size;
    }
}

/**
 * Memoization decorator for methods
 */
export function memoize<TArgs extends readonly unknown[], TReturn>(
    fn: (...args: TArgs) => TReturn,
    options: {
        maxSize?: number;
        keyGenerator?: (...args: TArgs) => string;
        ttl?: number; // Time to live in milliseconds
    } = {}
): (...args: TArgs) => TReturn {
    const { maxSize = 100, keyGenerator = (...args) => JSON.stringify(args), ttl } = options;
    const cache = new LRUCache<string, { value: TReturn; timestamp?: number }>(maxSize);

    return (...args: TArgs): TReturn => {
        const key = keyGenerator(...args);
        const now = Date.now();

        const cached = cache.get(key);
        if (cached && (!ttl || !cached.timestamp || now - cached.timestamp < ttl)) {
            return cached.value;
        }

        const result = fn(...args);
        cache.set(key, { value: result, ...(ttl ? { timestamp: now } : {}) });
        return result;
    };
}

/**
 * Async memoization with Promise caching
 */
export function memoizeAsync<TArgs extends readonly unknown[], TReturn>(
    fn: (...args: TArgs) => Promise<TReturn>,
    options: {
        maxSize?: number;
        keyGenerator?: (...args: TArgs) => string;
        ttl?: number;
    } = {}
): (...args: TArgs) => Promise<TReturn> {
    const { maxSize = 100, keyGenerator = (...args) => JSON.stringify(args), ttl } = options;
    const cache = new LRUCache<string, { promise: Promise<TReturn>; timestamp?: number }>(maxSize);

    return (...args: TArgs): Promise<TReturn> => {
        const key = keyGenerator(...args);
        const now = Date.now();

        const cached = cache.get(key);
        if (cached && (!ttl || !cached.timestamp || now - cached.timestamp < ttl)) {
            return cached.promise;
        }

        const promise = fn(...args);
        cache.set(key, { promise, ...(ttl ? { timestamp: now } : {}) });
        return promise;
    };
}

/**
 * Debounce function to limit rapid successive calls
 */
export function debounce<TArgs extends readonly unknown[]>(
    fn: (...args: TArgs) => void,
    delay: number
): (...args: TArgs) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return (...args: TArgs): void => {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            timeoutId = null;
            fn(...args);
        }, delay);
    };
}

/**
 * Throttle function to limit call frequency
 */
export function throttle<TArgs extends readonly unknown[]>(
    fn: (...args: TArgs) => void,
    limit: number
): (...args: TArgs) => void {
    let inThrottle = false;
    let lastFn: ReturnType<typeof setTimeout> | null = null;
    let lastTime = 0;

    return (...args: TArgs): void => {
        if (!inThrottle) {
            fn(...args);
            lastTime = Date.now();
            inThrottle = true;
        } else {
            if (lastFn) {
                clearTimeout(lastFn);
            }
            lastFn = setTimeout(
                () => {
                    if (Date.now() - lastTime >= limit) {
                        fn(...args);
                        lastTime = Date.now();
                    }
                    inThrottle = false;
                },
                Math.max(limit - (Date.now() - lastTime), 0)
            );
        }
    };
}

/**
 * Performance timing utility
 */
export class PerformanceTimer {
    private startTime = 0;
    private measurements: Array<{ name: string; duration: number }> = [];

    start(): void {
        this.startTime = performance.now();
        this.measurements = [];
    }

    mark(name: string): void {
        const duration = performance.now() - this.startTime;
        this.measurements.push({ name, duration });
    }

    end(logResults = true): Array<{ name: string; duration: number }> {
        const totalDuration = performance.now() - this.startTime;
        this.measurements.push({ name: 'total', duration: totalDuration });

        if (logResults && process.env.NODE_ENV === 'development') {
            // Performance measurements would be logged here in development
            // Group: Performance Measurements
            this.measurements.forEach(({ name: _name, duration: _duration }) => {
                // Log: `${_name}: ${_duration.toFixed(2)}ms`
            });
            // End group
        }

        return [...this.measurements];
    }
}

/**
 * Efficient object comparison for React-like optimizations
 */
export function shallowEqual<T extends Record<string, unknown>>(obj1: T, obj2: T): boolean {
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) {
        return false;
    }

    for (const key of keys1) {
        if (obj1[key] !== obj2[key]) {
            return false;
        }
    }

    return true;
}

/**
 * Deep freeze utility for immutable data
 */
export function deepFreeze<T>(obj: T): Readonly<T> {
    // Retrieve the property names defined on obj
    const propNames = Object.getOwnPropertyNames(obj);

    // Freeze properties before freezing self
    propNames.forEach((name) => {
        const value = (obj as Record<string, unknown>)[name];
        if (value && typeof value === 'object') {
            deepFreeze(value);
        }
    });

    return Object.freeze(obj);
}

/**
 * Batch operations for better performance
 */
export class BatchProcessor<T> {
    private batch: T[] = [];
    private readonly batchSize: number;
    private readonly processBatch: (items: T[]) => void;
    private timeout: ReturnType<typeof setTimeout> | null = null;
    private readonly flushDelay: number;

    constructor(
        processBatch: (items: T[]) => void,
        options: { batchSize?: number; flushDelay?: number } = {}
    ) {
        this.processBatch = processBatch;
        this.batchSize = options.batchSize ?? 10;
        this.flushDelay = options.flushDelay ?? 100;
    }

    add(item: T): void {
        this.batch.push(item);

        if (this.batch.length >= this.batchSize) {
            this.flush();
        } else if (this.timeout === null) {
            this.timeout = setTimeout(() => {
                this.flush();
            }, this.flushDelay);
        }
    }

    flush(): void {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }

        if (this.batch.length > 0) {
            this.processBatch([...this.batch]);
            this.batch = [];
        }
    }

    clear(): void {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
        this.batch = [];
    }
}

/**
 * Lazy value computation - only computed when accessed
 */
export class LazyValue<T> {
    private computed = false;
    private value: T | undefined;
    private readonly compute: () => T;

    constructor(compute: () => T) {
        this.compute = compute;
    }

    get(): T {
        if (!this.computed) {
            this.value = this.compute();
            this.computed = true;
        }
        return this.value as T;
    }

    reset(): void {
        this.computed = false;
        this.value = undefined;
    }

    isComputed(): boolean {
        return this.computed;
    }
}

/**
 * Resource pool for expensive object creation
 */
export class ObjectPool<T> {
    private available: T[] = [];
    private inUse = new Set<T>();
    private readonly create: () => T;
    private readonly reset: ((obj: T) => void) | undefined;
    private readonly maxSize: number;

    constructor(create: () => T, options: { reset?: (obj: T) => void; maxSize?: number } = {}) {
        this.create = create;
        this.reset = options.reset;
        this.maxSize = options.maxSize ?? 10;
    }

    acquire(): T {
        let obj: T;

        if (this.available.length > 0) {
            const popped = this.available.pop();
            if (popped) {
                obj = popped;
            } else {
                obj = this.create();
            }
        } else {
            obj = this.create();
        }

        this.inUse.add(obj);
        return obj;
    }

    release(obj: T): void {
        if (this.inUse.has(obj)) {
            this.inUse.delete(obj);

            if (this.reset) {
                this.reset(obj);
            }

            if (this.available.length < this.maxSize) {
                this.available.push(obj);
            }
        }
    }

    clear(): void {
        this.available = [];
        this.inUse.clear();
    }

    get stats() {
        return {
            available: this.available.length,
            inUse: this.inUse.size,
            total: this.available.length + this.inUse.size,
        };
    }
}
