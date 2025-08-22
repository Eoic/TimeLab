# TimeLab

A simple time series data labeling tool.

## Quick start

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Start development server**

   ```bash
   npm run dev
   ```

3. **Open browser** - Vite will automatically open http://localhost:3000.

## Scripts

| Command                 | Description                             |
| ----------------------- | --------------------------------------- |
| `npm run dev`           | Start development server with HMR.      |
| `npm run build`         | Build for production.                   |
| `npm run preview`       | Preview production build locally.       |
| `npm run test`          | Run tests once.                         |
| `npm run test:watch`    | Run tests in watch mode.                |
| `npm run test:ui`       | Open Vitest UI for interactive testing. |
| `npm run test:coverage` | Generate test coverage report.          |
| `npm run lint`          | Check code with ESLint.                 |
| `npm run lint:fix`      | Fix ESLint issues automatically.        |
| `npm run format`        | Format code with Prettier.              |
| `npm run type-check`    | Check TypeScript types.                 |
| `npm run ci`            | Run all checks (CI pipeline).           |

## Project structure

```
src/
├── main.ts              # Application entry point.
├── utils/
│   └── app.ts           # Application setup utilities.
├── styles/
│   └── _variables.scss  # SCSS variables and design tokens.
└── types/
    └── assets.d.ts      # Type definitions for assets.
styles/
├── main.scss            # Global styles.
└── _reset.scss          # CSS reset.
tests/
├── app.test.ts          # Example test file.
└── setup.ts             # Test environment setup.
```
