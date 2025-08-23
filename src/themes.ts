export const THEMES = [
    'dark',
    'oled',
    'high-contrast',
    'sepia',
    'light',
    'blue',
    'green',
    'purple',
    'auto',
] as const;
export type Theme = (typeof THEMES)[number];
