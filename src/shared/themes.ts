export const THEMES = [
    'auto',
    'light',
    'dark',
    'oled',
    'high-contrast',
    'sepia',
    'blue',
    'green',
    'purple',
] as const;

export type Theme = (typeof THEMES)[number];

// Theme attribute name template literal type
export type ThemeAttribute = `data-theme`;

// Theme data attribute value template literal type
export type ThemeDataAttribute = `[data-theme="${Exclude<Theme, 'auto'>}"]`;

// CSS variable theme prefix template literal type
export type ThemeVariablePrefix = `--theme-${Theme}`;

// Theme class name template literal type
export type ThemeClassName = `theme-${Theme}`;

// Storage key template literal type
export type ThemeStorageKey = `preferred-theme` | `theme-${Theme}-config`;

// Theme event name template literal type
export type ThemeEventName = `timelab:theme-changed` | `timelab:theme-${Theme}-applied`;

// Theme validation type guard
export function isValidTheme(value: string): value is Theme {
    return (THEMES as readonly string[]).includes(value);
}

// Get theme display name with proper typing
export function getThemeDisplayName(theme: Theme): string {
    const themeNames: Record<Theme, string> = {
        auto: 'Auto (System)',
        light: 'Light',
        dark: 'Dark',
        oled: 'OLED (Black)',
        'high-contrast': 'High Contrast',
        sepia: 'Sepia',
        blue: 'Blue',
        green: 'Green',
        purple: 'Purple',
    };
    return themeNames[theme];
}

// Theme category types for better organization
export type SystemTheme = Extract<Theme, 'auto'>;
export type BaseTheme = Extract<Theme, 'light' | 'dark'>;
export type AccessibilityTheme = Extract<Theme, 'high-contrast' | 'oled'>;
export type ColorVariantTheme = Extract<Theme, 'sepia' | 'blue' | 'green' | 'purple'>;

// Theme configuration interface with template literal keys
export type ThemeConfig = {
    readonly [K in ThemeStorageKey]?: K extends `theme-${string}-config` ? string : never;
} & {
    readonly 'preferred-theme'?: Theme;
};

// Theme metadata interface
export interface ThemeMetadata {
    readonly name: Theme;
    readonly displayName: string;
    readonly category: 'system' | 'base' | 'accessibility' | 'color-variant';
    readonly supportsDarkMode: boolean;
    readonly cssVariablePrefix: ThemeVariablePrefix;
}

// Complete theme metadata mapping
export const THEME_METADATA: Record<Theme, ThemeMetadata> = {
    auto: {
        name: 'auto',
        displayName: 'Auto (System)',
        category: 'system',
        supportsDarkMode: true,
        cssVariablePrefix: '--theme-auto',
    },
    light: {
        name: 'light',
        displayName: 'Light',
        category: 'base',
        supportsDarkMode: false,
        cssVariablePrefix: '--theme-light',
    },
    dark: {
        name: 'dark',
        displayName: 'Dark',
        category: 'base',
        supportsDarkMode: true,
        cssVariablePrefix: '--theme-dark',
    },
    oled: {
        name: 'oled',
        displayName: 'OLED (Black)',
        category: 'accessibility',
        supportsDarkMode: true,
        cssVariablePrefix: '--theme-oled',
    },
    'high-contrast': {
        name: 'high-contrast',
        displayName: 'High Contrast',
        category: 'accessibility',
        supportsDarkMode: true,
        cssVariablePrefix: '--theme-high-contrast',
    },
    sepia: {
        name: 'sepia',
        displayName: 'Sepia',
        category: 'color-variant',
        supportsDarkMode: false,
        cssVariablePrefix: '--theme-sepia',
    },
    blue: {
        name: 'blue',
        displayName: 'Blue',
        category: 'color-variant',
        supportsDarkMode: true,
        cssVariablePrefix: '--theme-blue',
    },
    green: {
        name: 'green',
        displayName: 'Green',
        category: 'color-variant',
        supportsDarkMode: true,
        cssVariablePrefix: '--theme-green',
    },
    purple: {
        name: 'purple',
        displayName: 'Purple',
        category: 'color-variant',
        supportsDarkMode: true,
        cssVariablePrefix: '--theme-purple',
    },
} as const;

// Utility types for theme operations
export type ThemeSelector = `[data-theme="${Theme}"]`;
export type ThemeSelectorString<T extends Theme> = `[data-theme="${T}"]`;

// CSS custom property names for themes
export type ThemeCustomProperty =
    | '--theme-primary-color'
    | '--theme-secondary-color'
    | '--theme-background-color'
    | '--theme-text-color'
    | '--theme-border-color';

// Type-safe theme utility functions
export type ThemeUtilityFunction<T extends Theme> = {
    readonly theme: T;
    readonly selector: ThemeSelectorString<T>;
    readonly metadata: ThemeMetadata;
    readonly cssVariablePrefix: ThemeVariablePrefix;
};

// Theme configuration validator type
export type ValidThemeConfig<T extends Theme> = {
    readonly theme: T;
    readonly config: ThemeConfig;
    readonly isValid: boolean;
};

// Theme CSS variable mapping type
export type ThemeCSSVariableMap = Record<ThemeCustomProperty, string>;

// Type-safe theme switcher interface
export interface ThemeSwitcher {
    getCurrentTheme(): Theme;
    switchToTheme(theme: Theme): Promise<void>;
    getThemeConfig(theme: Theme): ValidThemeConfig<Theme> | null;
    getSupportedThemes(): readonly Theme[];
}

// Template literal type for CSS class combinations
export type ThemeCSSClass<T extends Theme> =
    | `theme-${T}`
    | `theme-${T}--active`
    | `theme-${T}--loading`;

// Theme media query types
export type ThemeMediaQuery =
    | '(prefers-color-scheme: light)'
    | '(prefers-color-scheme: dark)'
    | '(prefers-contrast: high)'
    | '(prefers-reduced-motion: reduce)';

// Theme transition configuration
export type ThemeTransitionConfig = {
    readonly duration: `${number}ms`;
    readonly easing: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';
    readonly properties: readonly ThemeCustomProperty[];
};
