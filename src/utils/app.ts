import { THEMES } from '../themes';

/**
 * Initialize the application.
 */
export function setupApp(): void {
  const app = document.querySelector<HTMLDivElement>('#app');

  if (app) {
    app.innerHTML = `
      <div class="center text-center">
        <h1>TypeScript & Vite starter</h1>
        <ul class="card center text-left">
          <li> Edit <code>src/main.ts</code> and save to test HMR.</li>
          <li> Press "Next theme" button below to switch to the next theme </li>
          <li> Current theme is "<span id="current-theme">auto</span>". </li>
        </ul>
      </div>
    `;
  }

  setupInteractivity();
}

/**
 * Setup interactive features.
 */
function setupInteractivity(): void {
  let themeIndex = 0;
  const container = document.querySelector('#app')?.firstElementChild;
  const button = document.createElement('button');
  const currentTheme = document.getElementById('current-theme');

  if (!currentTheme) {
    throw new Error('Cannot find current theme display element');
  }

  button.textContent = 'Next theme';
  button.type = 'button';
  button.classList.add('mt-sm');

  button.addEventListener('click', () => {
    const theme = THEMES[++themeIndex % THEMES.length] as string;

    if (theme === 'auto') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }

    currentTheme.innerText = theme;
  });

  if (container) {
    container.appendChild(button);
  }
}
