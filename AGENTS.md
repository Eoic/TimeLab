# AGENTS

- Follow the guidelines in `docs/engineering-guide.md`.
- Use TypeScript with `strict` typing; never introduce `any`.
- Make data structures immutable where practical with `readonly`.
- Exported functions and methods require explicit return types.
- Keep side effects in dedicated platform modules.
- Before committing, run:
    - `npm run lint`
    - `npm run type-check`
    - `npm test`
