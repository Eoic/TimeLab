# TimeLab AI Instructions

## Project Overview

TimeLab is a time series data labeling tool built with TypeScript, Vite, and a sophisticated SCSS theming system. The codebase follows a modular architecture with emphasis on accessibility and theme switching capabilities.

## Architecture & key patterns

### Entry point & setup

- `src/main.ts` imports `setupApp()` from `@/utils/app.ts` and global styles
- Application bootstrapping happens in `src/utils/app.ts` (currently minimal but designed for expansion)
- Use the `@/` alias for src imports - configured in both `vite.config.ts` and `vitest.config.ts`

### SCSS architecture (critical understanding)

The styling system uses a layered approach with CSS custom properties for runtime theme switching:

1. **Tokens** (`src/styles/_tokens.scss`): Raw CSS custom properties (colors, spacing, typography)
2. **Semantic** (`src/styles/_semantic.scss`): SCSS variables mapping to CSS custom properties for development
3. **Theme Utils** (`src/styles/_theme-utils.scss`): Mixins for common patterns like `@include interactive-states()`, `@include surface-elevation(2)`
4. **Theme Variants** (`src/styles/_theme-variants.scss`): Theme-specific overrides via `[data-theme="dark"]` selectors

**Key Pattern**: Always use semantic SCSS variables (`$color-bg-primary`) instead of CSS custom properties directly. The build automatically includes tokens via `additionalData` in Vite config.

### Theme system

- Themes controlled by `data-theme` attribute on `<html>` element
- Available themes defined in `src/themes.ts`: `['dark', 'oled', 'high-contrast', 'sepia', 'light', 'blue', 'green', 'purple', 'auto']`
- Auto theme respects `prefers-color-scheme`
- Component styles in `styles/components/` use pure CSS with dashed borders pattern

### Component organization

- Global styles in `styles/main.scss` (imports all component stylesheets)
- Component-specific styles in `styles/components/` directory
- Components use semantic classes and CSS custom properties for theming

## Development workflow

### Essential commands

```bash
npm run dev          # Start dev server on port 3000 (auto-opens)
npm run ci           # Full CI pipeline: type-check + lint + test + build
npm run test:ui      # Interactive testing with Vitest UI
npm run test:coverage # Generate test coverage reports
```

### Linting & formatting

- Uses new ESLint flat config (`eslint.config.js`) with TypeScript strict rules
- Prettier integration with `eslint-plugin-prettier`
- Import ordering enforced with specific grouping (builtin, external, internal, etc.)
- Unused vars must be prefixed with `_` to avoid errors

### Testing setup

- Vitest with jsdom environment
- Global test utilities in `tests/setup.ts`
- Coverage configured to exclude config files and type definitions
- Use `@/` alias in tests (configured in vitest.config.ts)

## Project-specific conventions

### Styling best practices

- Always use `@use` instead of `@import` for SCSS modules
- Include semantic color imports: `@use '@/styles/semantic' as *;`
- Apply theme transitions: `@include theme-transition("color, background-color")`
- Use elevation mixins: `@include surface-elevation(1-4)` for consistent shadows

### TypeScript patterns

- Strict TypeScript configuration with `strictTypeChecked` ESLint rules
- Theme types exported as const assertions: `as const` pattern in `themes.ts`
- Explicit return types optional but inferrable types must be removed

### Build configuration

- Modern SCSS API enabled in Vite
- Chunking strategy: vendor chunks for node_modules
- Source maps enabled for debugging
- ESNext target for modern JavaScript features

### Other guidelines

- Use sentence case for titles.

## Integration points

### Key dependencies

- **Vite**: Build tool with SCSS preprocessing and alias resolution
- **Vitest**: Testing framework with jsdom for DOM testing
- **SCSS**: Styling with modern API and automatic token injection
- **ESLint + Prettier**: Code quality with flat config and strict TypeScript rules

### File structure significance

- `src/styles/`: Core theming system (tokens, semantic variables, utils, variants)
- `styles/`: Application-level styles and components
- `tests/`: Test setup and utilities
- Root config files: Modern flat configs for ESLint, separate TS configs for different contexts

## Future development notes

The `NOTES.md` file contains detailed UX specifications for the core time series labeling interface, including:

- Chart configuration patterns (collapsible accordions)
- Labeling interactions (click-drag, keyboard shortcuts, snapping)
- Performance considerations (Canvas/WebGL rendering, virtualization)
- Accessibility features (colorblind-safe palettes, pattern overlays)

When implementing these features, follow the established theming patterns and maintain the semantic color system for consistency across all themes.
