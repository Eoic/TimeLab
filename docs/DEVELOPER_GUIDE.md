# TimeLab Developer Guide

This guide covers the advanced architectural patterns and practices implemented in TimeLab. Follow these guidelines to maintain code quality, performance, and architectural consistency.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Service Architecture](#service-architecture)
- [Type System](#type-system)
- [Performance Patterns](#performance-patterns)
- [Error Handling](#error-handling)
- [Testing Strategies](#testing-strategies)
- [Code Quality Guidelines](#code-quality-guidelines)

## Architecture Overview

TimeLab follows a layered, dependency-injected architecture with strong type safety:

```
┌─────────────────┐
│   UI Layer      │ ← Components, interactions
├─────────────────┤
│ Services Layer  │ ← Business logic, DI container
├─────────────────┤
│   Data Layer    │ ← Data management, processing
├─────────────────┤
│ Platform Layer  │ ← Storage, browser APIs
├─────────────────┤
│ Domain Layer    │ ← Pure business logic
└─────────────────┘
```

### Core Principles

1. **Dependency Direction**: Dependencies flow inward toward domain
2. **Separation of Concerns**: Each layer has a single responsibility
3. **Type Safety**: Leverage TypeScript's advanced type system
4. **Performance**: Optimize with memoization and caching
5. **Testability**: Design for easy testing and mocking

## Service Architecture

### Dependency Injection Container

The DI container manages service lifetimes and dependencies:

```typescript
// src/services/container.ts
export class ServiceContainer implements IServiceContainer {
    register<T>(token: ServiceToken<T>, factory: () => T): void
    registerSingleton<T>(token: ServiceToken<T>, factory: () => T): void
    get<T>(token: ServiceToken<T>): T
    dispose(): void // Cleanup with destroy() calls
}
```

### Creating New Services

1. **Define the Interface**:
```typescript
// src/types/myService.ts
export interface IMyService {
    doSomething(param: string): Promise<Result<Data, Error>>;
    destroy(): void; // Required for cleanup
}
```

2. **Implement the Service**:
```typescript
// src/services/myService.ts
export class MyService implements IMyService {
    constructor(private dependency: IDependency) {}
    
    async doSomething(param: string): Promise<Result<Data, Error>> {
        // Implementation
    }
    
    destroy(): void {
        // Cleanup resources
    }
}
```

3. **Register in Container**:
```typescript
// src/services/serviceRegistry.ts
export function initializeServices(): void {
    container.registerSingleton(SERVICE_TOKENS.MyService, () => 
        new MyService(getDependency())
    );
}
```

4. **Add Getter Function**:
```typescript
export function getMyService(): MyService {
    return container.get(SERVICE_TOKENS.MyService) as MyService;
}
```

### Service Lifecycle Best Practices

- **Initialize**: Services start in dependency order
- **Cleanup**: Always implement `destroy()` method
- **Memory**: Remove event listeners, clear caches
- **Testing**: Use `resetServiceContainer()` between tests

## Type System

### Branded Types for Safety

Prevent ID confusion with branded types:

```typescript
import { ProjectId, createProjectId } from '@shared/types';

// ✅ Type-safe ID creation
const projectId = createProjectId('project_123');

// ❌ Prevents accidental mixing
function updateProject(id: ProjectId): void { /* ... */ }
const labelId = createLabelDefinitionId('label_456');
updateProject(labelId); // TypeScript error!
```

### Utility Types

Common patterns made easy:

```typescript
import type { 
    PartialExcept, 
    WithRequired, 
    DeepReadonly,
    NonNullable
} from '@shared/types';

// Require specific fields, make others optional
type CreateUser = PartialExcept<User, 'email' | 'name'>;

// Add required fields to existing type
type UserWithTimestamps = WithRequired<User, 'createdAt' | 'updatedAt'>;

// Deep immutability
type ImmutableState = DeepReadonly<AppState>;

// Remove null/undefined
type DefiniteValue = NonNullable<string | null | undefined>; // string
```

### Event System Types

Type-safe event handling:

```typescript
import type { EventEmitter, EventHandlerMap } from '@shared/types';

interface MyEvents {
    dataLoaded: { count: number };
    errorOccurred: { message: string };
}

class MyComponent implements EventEmitter<MyEvents> {
    private handlers: EventHandlerMap<MyEvents> = {};
    
    on<K extends keyof MyEvents>(event: K, listener: (data: MyEvents[K]) => void) {
        // Implementation
    }
}
```

## Performance Patterns

### Memoization

Cache expensive computations:

```typescript
import { memoize, memoizeAsync } from '@shared/performance';

// Synchronous memoization
const processData = memoize((data: RawData[]) => {
    return data.map(item => expensiveTransform(item));
}, { 
    maxSize: 100,        // Limit cache size
    ttl: 5000,          // 5 second TTL
    keyGenerator: (data) => data.map(d => d.id).join(',')
});

// Async memoization for API calls
const fetchUser = memoizeAsync(async (userId: string) => {
    const response = await api.getUser(userId);
    return response.data;
}, { maxSize: 50, ttl: 30000 });
```

### Debouncing and Throttling

Control event frequency:

```typescript
import { debounce, throttle } from '@shared/performance';

// Debounce for user input (wait for pause)
const searchInput = document.querySelector('#search');
const debouncedSearch = debounce((query: string) => {
    performSearch(query);
}, 300);

searchInput.addEventListener('input', (e) => {
    debouncedSearch(e.target.value);
});

// Throttle for scroll events (limit frequency)
const throttledScroll = throttle(() => {
    updateScrollPosition();
}, 16); // ~60fps

window.addEventListener('scroll', throttledScroll);
```

### LRU Caching

Efficient memory-bounded caching:

```typescript
import { LRUCache } from '@shared/performance';

class ChartService {
    private dataCache = new LRUCache<string, ProcessedData>(100);
    
    getProcessedData(sourceId: string): ProcessedData {
        // Check cache first
        let data = this.dataCache.get(sourceId);
        if (data) return data;
        
        // Compute and cache
        data = this.processRawData(sourceId);
        this.dataCache.set(sourceId, data);
        return data;
    }
}
```

### Batch Processing

Group operations for efficiency:

```typescript
import { BatchProcessor } from '@shared/performance';

const updateProcessor = new BatchProcessor<Update>(
    (updates: Update[]) => {
        // Process all updates at once
        api.batchUpdate(updates);
    },
    { batchSize: 10, flushDelay: 100 }
);

// Individual calls are batched automatically
updates.forEach(update => updateProcessor.add(update));
```

## Error Handling

### Result Pattern

Predictable error handling without exceptions:

```typescript
import type { Result } from '@shared/result';
import { ok, err, isOk, isErr } from '@shared/result';

async function loadData(id: string): Promise<Result<Data, DataError>> {
    try {
        const data = await api.getData(id);
        return ok(data);
    } catch (error) {
        return err(new DataError('Failed to load data', error));
    }
}

// Usage
const result = await loadData('123');
if (isOk(result)) {
    console.log(result.value); // Data
} else {
    console.error(result.error); // DataError
}
```

### Validation Types

Type-safe validation:

```typescript
import type { ValidationResult, Validator } from '@shared/types';

const emailValidator: Validator<string> = (value: unknown) => {
    if (typeof value !== 'string') {
        return { success: false, errors: ['Must be a string'] };
    }
    if (!value.includes('@')) {
        return { success: false, errors: ['Invalid email format'] };
    }
    return { success: true, data: value };
};

// Usage
const result = emailValidator(userInput);
if (result.success) {
    const email: string = result.data; // Type-safe
}
```

## Testing Strategies

### Service Testing with DI

Test services in isolation:

```typescript
import { resetServiceContainer, getServiceContainer } from '@services/container';
import { SERVICE_TOKENS } from '@services/container';

describe('MyService', () => {
    let mockDependency: jest.Mocked<IDependency>;
    
    beforeEach(() => {
        resetServiceContainer(); // Clean slate
        
        mockDependency = {
            doSomething: jest.fn(),
        };
        
        // Inject mock
        const container = getServiceContainer();
        container.registerSingleton(SERVICE_TOKENS.Dependency, () => mockDependency);
    });
    
    afterEach(() => {
        resetServiceContainer(); // Cleanup
    });
});
```

### Branded Type Testing

Create type-safe test data:

```typescript
import { createProjectId, createLabelDefinitionId } from '@shared/types';

describe('Project operations', () => {
    it('should handle project updates', () => {
        const projectId = createProjectId('test_project_123');
        const result = updateProject(projectId, { name: 'New Name' });
        
        expect(result.success).toBe(true);
    });
});
```

## Code Quality Guidelines

### Import Organization

Follow consistent import ordering:

```typescript
// 1. Node built-ins
import path from 'node:path';

// 2. External libraries
import { expect, describe, it } from 'vitest';

// 3. Internal imports (absolute paths first)
import type { Result } from '@shared/result';
import { ProjectService } from '@services/projectService';

// 4. Relative imports
import { validateInput } from './utils';
import type { LocalType } from '../types';
```

### TypeScript Best Practices

1. **Use `const` assertions** for immutable data:
```typescript
const themes = ['light', 'dark', 'auto'] as const;
type Theme = typeof themes[number]; // 'light' | 'dark' | 'auto'
```

2. **Prefer `unknown` over `any`**:
```typescript
// ❌ Dangerous
function process(data: any) { /* ... */ }

// ✅ Safe
function process(data: unknown) {
    if (typeof data === 'string') {
        // TypeScript knows data is string here
    }
}
```

3. **Use branded types for IDs**:
```typescript
// ❌ Stringly typed
function getProject(id: string): Project { /* ... */ }

// ✅ Type safe
function getProject(id: ProjectId): Project { /* ... */ }
```

4. **Prefer readonly for immutability**:
```typescript
interface Config {
    readonly name: string;
    readonly options: readonly string[];
}
```

### Performance Guidelines

1. **Use memoization for expensive operations**
2. **Debounce user input events**
3. **Throttle high-frequency events (scroll, resize)**
4. **Cache computed values with LRU**
5. **Batch similar operations**
6. **Clean up resources in `destroy()` methods**

### Memory Management

Always clean up resources:

```typescript
class Component {
    private resizeObserver: ResizeObserver | null = null;
    private eventUnsubscribe: (() => void) | null = null;
    
    constructor() {
        this.resizeObserver = new ResizeObserver(this.handleResize);
        this.eventUnsubscribe = eventEmitter.on('change', this.handleChange);
    }
    
    destroy(): void {
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        
        this.eventUnsubscribe?.();
        this.eventUnsubscribe = null;
    }
}
```

## Common Patterns

### Lazy Initialization

```typescript
import { LazyValue } from '@shared/performance';

class ExpensiveResource {
    private lazyData = new LazyValue(() => this.computeExpensiveData());
    
    getData() {
        return this.lazyData.get(); // Computed only once
    }
    
    reset() {
        this.lazyData.reset(); // Force recomputation next time
    }
}
```

### Object Pool for Performance

```typescript
import { ObjectPool } from '@shared/performance';

const canvasPool = new ObjectPool(
    () => document.createElement('canvas'),
    { 
        reset: (canvas) => {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
        },
        maxSize: 10 
    }
);

// Use pooled objects
const canvas = canvasPool.acquire();
// ... use canvas ...
canvasPool.release(canvas); // Return to pool
```

This guide provides the foundation for working with TimeLab's advanced architecture. Follow these patterns to maintain code quality, performance, and maintainability.