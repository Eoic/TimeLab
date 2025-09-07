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
