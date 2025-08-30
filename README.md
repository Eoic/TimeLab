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

## Building & deployment

To create a production build with static assets:

```bash
npm run build
```

This outputs the app to the `dist/` directory with **relative asset paths** so it can be served from any URL prefix.
Verify the output locally with:

```bash
npm run preview
```

### Hosting

- **Any static server**: copy the contents of `dist/` to your server's public directory.
- **Vercel**: the included `vercel.json` config uses `npm run build` and serves the `dist/` folder.
