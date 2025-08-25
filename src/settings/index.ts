import { THEMES, type Theme } from '@/themes';

export function setupSettings(): void {
    const settingsButton = document.getElementById('btn-settings');

    if (!settingsButton) {
        return;
    }

    // Restore saved theme on startup
    restoreTheme();

    // Create dropdown element like snap settings does
    const dd = document.createElement('tl-dropdown');
    dd.setAttribute('placeholder', 'Change theme');
    dd.style.position = 'absolute';
    dd.style.left = '-9999px';
    dd.style.top = '0';
    dd.classList.add('theme-dropdown'); // Add class for custom styling

    // Initialize theme dropdown options
    const themeOptions = THEMES.map((theme) => ({
        value: theme,
        label: formatThemeName(theme),
    }));

    dd.options = themeOptions;
    document.body.appendChild(dd);

    // Set current theme as selected
    const currentTheme = getCurrentTheme();
    dd.value = currentTheme;

    // Handle theme changes
    dd.addEventListener('change', (event: Event) => {
        const customEvent = event as CustomEvent<{ value: string }>;
        const newTheme = customEvent.detail.value as Theme;
        setTheme(newTheme);
    });

    // Open dropdown when settings button is clicked
    settingsButton.addEventListener('click', (event) => {
        event.preventDefault();
        dd.value = getCurrentTheme(); // Update selection before opening
        dd.open(settingsButton);
    });
}

/**
 * Restore theme from localStorage on startup
 */
function restoreTheme(): void {
    try {
        const saved = localStorage.getItem('preferred-theme') as Theme | null;
        if (saved && (THEMES as readonly string[]).includes(saved)) {
            setTheme(saved);
        }
    } catch {
        // Ignore storage errors
    }
}

/**
 * Set the application theme
 */
function setTheme(theme: Theme): void {
    if (theme === 'auto') {
        // Remove data-theme attribute to use system preference
        document.documentElement.removeAttribute('data-theme');
    } else {
        // Set specific theme
        document.documentElement.setAttribute('data-theme', theme);
    }

    // Store theme preference in localStorage
    try {
        localStorage.setItem('preferred-theme', theme);
    } catch {
        // Ignore storage errors
    }
}

/**
 * Get the current active theme
 */
function getCurrentTheme(): Theme {
    // First check localStorage for saved preference
    try {
        const saved = localStorage.getItem('preferred-theme') as Theme | null;
        if (saved && (THEMES as readonly string[]).includes(saved)) {
            return saved;
        }
    } catch {
        // Ignore storage errors
    }

    // Check data-theme attribute
    const dataTheme = document.documentElement.getAttribute('data-theme') as Theme | null;
    if (dataTheme && (THEMES as readonly string[]).includes(dataTheme)) {
        return dataTheme;
    }

    // Default to auto if no explicit theme is set
    return 'auto';
}

/**
 * Format theme name for display
 */
function formatThemeName(theme: Theme): string {
    switch (theme) {
        case 'auto':
            return 'Auto (System)';
        case 'light':
            return 'Light';
        case 'dark':
            return 'Dark';
        case 'oled':
            return 'OLED (Black)';
        case 'high-contrast':
            return 'High Contrast';
        case 'sepia':
            return 'Sepia';
        case 'blue':
            return 'Blue';
        case 'green':
            return 'Green';
        case 'purple':
            return 'Purple';
    }
}
