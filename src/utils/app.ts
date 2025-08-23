// Load in the trace types for pie, and choropleth

export function setupApp(): void {
  const app = document.querySelector<HTMLDivElement>('#app');

  if (app) {
    // app.innerHTML = `
    //   <div class="center text-center">
    //     <ul class="card center text-left">
    //     </ul>
    //   </div>
    // `;
  }
}

// function setupInteractivity(): void {
//   let themeIndex = 0;
//   const container = document.querySelector('#app')?.firstElementChild;
//   const button = document.createElement('button');
//   const currentTheme = document.getElementById('current-theme');

//   if (!currentTheme) {
//     throw new Error('Cannot find current theme display element');
//   }

//   button.textContent = 'Next theme';
//   button.type = 'button';
//   button.classList.add('mt-sm');

//   button.addEventListener('click', () => {
//     const theme = THEMES[++themeIndex % THEMES.length] as string;

//     if (theme === 'auto') {
//       document.documentElement.removeAttribute('data-theme');
//     } else {
//       document.documentElement.setAttribute('data-theme', theme);
//     }

//     currentTheme.innerText = theme;
//   });

//   if (container) {
//     container.appendChild(button);
//   }
// }
