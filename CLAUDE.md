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
TimeLab is a TypeScript time series data labeling tool with a modular architecture:

- **Entry Point**: `src/main.ts` orchestrates app initialization with loading screen integration
- **App Layer**: `src/app/` contains bootstrap logic (`initializeApp` from `app/bootstrap.ts`)  
- **Core Modules**:
  - `src/charts/` - Time series chart implementations (main feature)
  - `src/data/` - Data management and persistence
  - `src/ui/` - UI components and interactions
  - `src/platform/` - Platform-specific functionality (storage, etc.)
  - `src/domain/` - Business logic and domain models

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
- **Result Pattern**: Use `Result<T, E>` for predictable error handling instead of throwing exceptions
- **Event-Driven Communication**: Use typed custom events for component communication
- **Memory Management**: Always clean up event listeners and observers in destroy methods
- **Type Safety**: Prefer compile-time safety over runtime checks, avoid `any` usage

### Error Handling Standards
- Use `Result<T, E>` pattern for async operations that can fail
- Create specific error types extending `TimeLabError`
- Handle promises explicitly - avoid floating promises in event handlers
- Log errors with structured information for debugging

### Performance Guidelines
- Use `ResizeObserver` for responsive components with proper cleanup
- Implement lazy loading for large datasets
- Use defensive copying with `readonly` types for immutable data
- Debounce user input events where appropriate

### Testing Principles
- Write integration tests for key workflows
- Mock external dependencies properly 
- Use dependency injection to improve testability
- Avoid singleton patterns that make testing difficult