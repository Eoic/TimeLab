# Theme System Documentation

## Overview

Template includes theme switching system built with modern SCSS and CSS custom properties. The system supports multiple themes, accessibility options, and automatic dark mode detection.

## Features

### **Multiple theme support**

- **Light theme** (default).
- **Dark theme** (automatic via `prefers-color-scheme`).
- **Color variants**: blue, green, purple.
- **Accessibility themes**: high contrast, sepia.
- **OLED theme** (pure black for power efficiency).

### ♿ **Accessibility features**

- High contrast theme for better visibility.
- Sepia theme for reduced eye strain.
- Respects `prefers-reduced-motion`.
- Respects `prefers-contrast: high`.
- Focus indicators on all interactive elements.

### **Optimizations**

- CSS custom properties for runtime theme switching.
- Smooth transitions between themes.
- Minimal CSS bundle size with shared tokens.

## Usage

### Basic Theme Switching

Add a `data-theme` attribute to the `<html>` element. For example:

```html
<!-- Light theme (default) -->
<html>
  <!-- content -->
</html>

<!-- Dark theme -->
<html data-theme="dark">
  <!-- content -->
</html>
```

### Automatic theme detection

Without a `data-theme` attribute, the system automatically switches based on the user's system preference:

### JavaScript theme switching

Set a theme:

```javascript
document.documentElement.setAttribute('data-theme', 'dark');
```

Remove theme (use system preferences):

```javascript
document.documentElement.removeAttribute('data-theme');
```

Get current theme:

```javascript
const currentTheme = document.documentElement.getAttribute('data-theme');
```

## SCSS development

### Using semantic colors

```scss
@use '@/styles/semantic' as *;

.component {
  background-color: $color-bg-primary;
  color: $color-text-primary;
  border: 1px solid $color-border-primary;
}
```

### Using theme mixins

```scss
@use '@/styles/theme-utils' as *;

.my-button {
  @include interactive-states();
  // Automatically handles hover, focus, and disabled states.
}

.my-card {
  @include surface-elevation(2);
  // Adds appropriate shadow and background.
}

.my-input {
  @include theme-transition('border-color, box-shadow');
  // Smooth transitions when theme changes.
}
```

### Creating theme-aware components

```scss
.notification {
  // Base styles using semantic tokens.
  background-color: $color-bg-secondary;
  color: $color-text-primary;
  border-radius: $border-radius;
  padding: $spacing-md;
  @include theme-transition();

  // State variants.
  &.success {
    background-color: $color-success;
    color: $color-text-inverse;
  }

  &.error {
    background-color: $color-error;
    color: $color-text-inverse;
  }
}
```

## Available design tokens

### Colors

- `$color-primary` - primary brand color.
- `$color-bg-primary` - main background color.
- `$color-text-primary` - main text color.
- `$color-border-primary` - default border color.
- `$color-surface-raised` - elevated surface color.

### Typography

- `$font-family-base` - default font stack.
- `$font-size-base` - base font size (1rem).
- `$font-weight-normal` - regular font weight (400).

### Spacing

- `$spacing-xs` - extra small spacing (0.5rem).
- `$spacing-sm` - small spacing (1rem).
- `$spacing-md` - medium spacing (1.5rem).
- `$spacing-lg` - large spacing (2rem).

### Shadows

- `$shadow-sm` - subtle shadow.
- `$shadow-md` - medium shadow.
- `$shadow-lg` - large shadow.

## Utility classes

The system includes utility classes for quick styling:

Text colors:

```html
<div class="text-primary">Primary text</div>
<div class="text-secondary">Secondary text</div>
<div class="text-muted">Muted text</div>
```

Background colors:

```html
<div class="bg-primary">Primary background</div>
<div class="bg-secondary">Secondary background</div>
```

Surface elevations:

```html
<div class="surface-raised">Raised surface</div>
<div class="surface-elevated">Elevated surface</div>
```

Borders:

```html
<div class="border-primary">With border</div>
```

Theme transitions:

```html
<div class="theme-transition">Smooth theme transitions</div>
```

## File structure

```
src/styles/
├── _tokens.scss          # Core design tokens and theme definitions.
├── _semantic.scss        # SCSS variables mapping to CSS properties.
├── _theme-utils.scss     # Mixins and utility classes.
├── _theme-variants.scss  # Additional theme variants.
└── _index.scss           # Main export file.
```

## Adding custom themes.

1. Define your theme in `src/styles/_theme-variants.scss`:

```scss
[data-theme='custom'] {
  --color-primary: #your-color;
  --color-bg-primary: #your-bg;
  --color-text-primary: #your-text;
  // ... other tokens.
}
```

2. The theme will automatically work with all existing components.

## Best practices

1. **Always use semantic tokens** instead of raw colors.
2. **Add theme transitions** to components that change appearance.
3. **Test with all themes** during development.
4. **Consider accessibility** when adding new themes.
5. **Use mixins** for consistent interactive states.

## Browser support

- CSS Custom Properties (all modern browsers).
- `prefers-color-scheme` (95%+ browser support).
- `prefers-reduced-motion` (90%+ browser support).
- `prefers-contrast` (newer browsers, graceful fallback).
