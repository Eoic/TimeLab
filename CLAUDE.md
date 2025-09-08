# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development
- `npm run dev` - Start development server on port 3000 (auto-opens browser)
- `npm run build` - TypeScript compilation + Vite build for production
- `npm run preview` - Preview production build locally on port 4173

### Code Quality
- `npm run ci` - Full CI pipeline: type-check + lint + test + build
- `npm run type-check` - TypeScript type checking without emit
- `npm run lint` - ESLint with TypeScript strict rules
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Format code with Prettier

### Testing
- `npm run test` - Run tests once with Vitest
- `npm run test:watch` - Run tests in watch mode
- `npm run test:ui` - Interactive testing with Vitest UI
- `npm run test:coverage` - Generate test coverage report
- `npm run test:e2e` - Run Cypress end-to-end tests
- `npm run test:e2e:open` - Open Cypress interactive runner

## Architecture

### Project Structure
TimeLab is a TypeScript time series data labeling tool with a clean, layered architecture:

- **Entry Point**: `src/main.ts` orchestrates app initialization with loading screen integration
- **App Layer**: `src/app/bootstrap.ts` provides service initialization and composition root
- **Services Layer**: `src/services/` contains dependency injection container and service registry
  - `container.ts` - Dependency injection container with lifecycle management
  - `serviceRegistry.ts` - Service registration and factory functions
  - `projectService.ts` - Project management with injected storage dependencies
  - `labelService.ts` - Label management with cascade operations and cleanup
- **Core Modules**:
  - `src/charts/` - Time series chart implementations (main feature)
  - `src/data/` - Data management, processing, and centralized data service
  - `src/ui/` - UI components and interactions
  - `src/platform/` - Platform-specific functionality (storage, etc.)
  - `src/domain/` - Pure business logic and domain models
  - `src/shared/` - Utility types, performance optimizations, and common functionality

### Import Aliases
Configured in `vite.config.ts` and `vitest.config.ts`:
- `@/` → `src/` (primary alias)
- `@app` → `src/app`
- `@domain` → `src/domain`
- `@platform` → `src/platform`  
- `@charts` → `src/charts`
- `@ui` → `src/ui`
- `@styles` → `src/styles`
- `@shared` → `src/shared`
- `@workers` → `src/workers`
- `@services` → `src/services`

### SCSS Theming System
Critical dual-directory structure for styling:

**`src/styles/` (Core theming system)**:
- `abstracts/tokens` - Raw CSS custom properties (colors, spacing, typography)
- `_semantic.scss` - SCSS variables mapping to CSS properties for development  
- `_theme-variants.scss` - Theme-specific overrides via `[data-theme="theme-name"]`
- `abstracts/` - Mixins and utility functions

**`styles/` (Application styles)**:
- `components/` - Component-specific stylesheets
- `main.scss` - Global styles importing all components

**Key Pattern**: Always use semantic SCSS variables (`$color-bg-primary`) instead of CSS custom properties directly. Tokens are auto-injected via Vite's `additionalData` configuration.

### Theme System
- Themes controlled by `data-theme` attribute on `<html>` element
- Available themes: dark, oled, high-contrast, sepia, light, blue, green, purple, auto
- Auto theme respects `prefers-color-scheme`
- Runtime theme switching via CSS custom properties

### Development Debug Tools
In development mode, global functions are exposed:
- `window.__timeSeriesController` - Main chart controller for debugging
- `window.__resetDatabase()` - Reset IndexedDB storage

## Configuration Files

### Build & Development
- **Vite**: Modern build tool with SCSS preprocessing and path aliases
- **TypeScript**: Strict configuration with separate configs for different contexts
- **ESLint**: Flat config (`eslint.config.js`) with `@typescript-eslint/strict-type-checked`
- **Prettier**: Code formatting integrated with ESLint
- **Husky**: Git hooks with lint-staged for pre-commit quality checks

### Testing
- **Vitest**: Testing framework with jsdom environment
- **Cypress**: E2E testing with component testing support
- Coverage excludes config files and type definitions
- Global test utilities in `tests/setup.ts`

## Development Guidelines

### Styling Best Practices
- Use `@use` instead of `@import` for SCSS modules
- Include semantic imports: `@use '@/styles/semantic' as *;`
- Apply theme transitions for smooth theme switching
- Use elevation mixins for consistent shadows

### TypeScript Patterns  
- Strict TypeScript with `strictTypeChecked` ESLint rules
- Theme types use const assertions (`as const`)
- Import ordering enforced: builtin → external → internal
- Unused variables must be prefixed with `_`

### Code Quality
- Always run `npm run ci` before committing (type-check + lint + test + build)
- Use sentence case for titles
- Modern JavaScript features (ESNext target)
- Source maps enabled for debugging

### Architecture Patterns
- **Domain-First Design**: Keep business logic in `src/domain/` with no external dependencies
- **Dependency Injection**: Use service registry and container for loose coupling and testability
- **Result Pattern**: Use `Result<T, E>` for predictable error handling instead of throwing exceptions
- **Event-Driven Communication**: Use typed custom events for component communication
- **Memory Management**: Always clean up event listeners and observers in destroy methods
- **Type Safety**: Use branded types for IDs, utility types for common patterns
- **Performance Optimization**: Leverage memoization, caching, and debouncing from `@shared/performance`

### Error Handling Standards
- Use `Result<T, E>` pattern for async operations that can fail
- Create specific error types extending `TimeLabError`
- Handle promises explicitly - avoid floating promises in event handlers
- Log errors with structured information for debugging

### Performance Guidelines
- Use `ResizeObserver` for responsive components with proper cleanup
- Implement lazy loading for large datasets
- Use defensive copying with `readonly` types for immutable data
- Leverage memoization with `memoize()` and `memoizeAsync()` from `@shared`
- Use `debounce()` and `throttle()` for user input events
- Apply `LRUCache` for expensive computations with size limits

### Testing Principles
- Write integration tests for key workflows
- Mock external dependencies properly 
- Use dependency injection container for testable service isolation
- Leverage `resetServiceContainer()` for test cleanup
- Use branded types and factory functions for type-safe test data

## Service Architecture

### Dependency Injection System
TimeLab uses a sophisticated dependency injection system for loose coupling:

```typescript
import { getServiceContainer, SERVICE_TOKENS } from '@services/container';
import { getProjectService, getLabelService, getDataService } from '@services/serviceRegistry';

// Services are registered as singletons with dependency injection
const projectService = getProjectService(); // Uses injected storage
const labelService = getLabelService();     // Uses injected data manager  
const dataService = getDataService();       // Centralized data operations
```

### Service Lifecycle
1. **Initialization**: `startServices()` initializes all services in dependency order
2. **Registration**: Services register with the container using tokens
3. **Injection**: Dependencies are injected via constructor parameters
4. **Cleanup**: `shutdownServices()` properly disposes resources

### Adding New Services
1. Create service interface and implementation
2. Add service token to `SERVICE_TOKENS`
3. Register in `serviceRegistry.ts` with dependencies
4. Add getter function for easy access
5. Include in startup/shutdown lifecycle

## Type System Enhancements

### Branded Types for ID Safety
Use branded types to prevent ID mismatches:

```typescript
import { ProjectId, LabelDefinitionId, createProjectId } from '@shared';

// Type-safe ID handling
const projectId: ProjectId = createProjectId('proj_123');
const labelId: LabelDefinitionId = createLabelDefinitionId('label_456');

// Compiler prevents mixing different ID types
function updateProject(id: ProjectId) { /* ... */ }
updateProject(labelId); // ❌ TypeScript error
```

### Utility Types for Common Patterns
Leverage utility types for cleaner code:

```typescript
import type { PartialExcept, WithRequired, DeepReadonly } from '@shared';

// Require specific fields while making others optional
type CreateProject = PartialExcept<Project, 'name' | 'isDefault'>;

// Make certain fields required
type ProjectWithMetadata = WithRequired<Project, 'createdAt' | 'updatedAt'>;

// Deep immutability
type ImmutableConfig = DeepReadonly<Configuration>;
```

### Performance Optimization Patterns

#### Memoization for Expensive Operations
```typescript
import { memoize, memoizeAsync } from '@shared/performance';

// Synchronous memoization
const expensiveCalculation = memoize((data: number[]) => {
    return data.reduce((sum, val) => sum + Math.sqrt(val), 0);
}, { maxSize: 100, ttl: 5000 });

// Async memoization with TTL
const loadUserData = memoizeAsync(async (userId: string) => {
    return await api.getUser(userId);
}, { maxSize: 50, ttl: 30000 });
```

#### Event Handling with Debouncing
```typescript
import { debounce, throttle } from '@shared/performance';

// Debounced search input
const debouncedSearch = debounce((query: string) => {
    performSearch(query);
}, 300);

// Throttled scroll handling
const throttledScroll = throttle(() => {
    updateScrollPosition();
}, 16); // ~60fps
```

#### Caching with LRU
```typescript
import { LRUCache } from '@shared/performance';

const chartDataCache = new LRUCache<string, ChartData>(100);

function getChartData(sourceId: string): ChartData {
    const cached = chartDataCache.get(sourceId);
    if (cached) return cached;
    
    const data = computeChartData(sourceId);
    chartDataCache.set(sourceId, data);
    return data;
}
```