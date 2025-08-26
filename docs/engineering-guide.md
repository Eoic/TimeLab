# TypeScript Web Project – Engineering & Refactoring Guide (for Copilot + humans)

> Paste this file into your repo (e.g., `docs/engineering-guide.md`) and link it from the README. Use the **Prompt Library** at the end when asking Copilot to refactor code.

---

## 0) Goals & Non‑Goals

**Goals**

- Consistent, readable, maintainable TypeScript.
- Clear project structure with strict module boundaries.
- Predictable error handling, logging, and testing.
- Tooling that enforces rules automatically (ESLint + Prettier + strict TS).

**Non‑Goals**

- Bikeshedding on formatting. Prettier decides formatting; we focus on design and correctness.

---

## 0a) Project Profile (Time series labeling tool – offline‑first)

- Runtime: **browser only** (desktop & mobile). **No server component.**
- Build tool: **Vite**.
- Charts: **Apache ECharts** for time‑series rendering (minimap, zoom, shaded regions).
- Styling: **SCSS**, **no external UI libraries or frameworks**.
- Theming: see **`THEMING.md`** (authoritative). Use **CSS variables** for runtime theming; SCSS for structure/composition.
- Data: **local‑only** (IndexedDB/CacheStorage) with **export/import** for portability and backups.

---

## 1) Core Principles

1. **Types first**: Strive for zero `any`. Prefer `unknown` over `any` and narrow with type guards.
2. **Small, pure units**: Prefer small, pure functions; push side effects to the edges (I/O, DOM, network).
3. **Explicitness**: Explicit return types for exported functions; explicit access modifiers and visibility.
4. **Immutability by default**: Use `readonly`, `as const`, and structural cloning; avoid in‑place mutation unless proven beneficial.
5. **Fail loud at boundaries**: Validate inputs at module boundaries; throw typed errors or return typed `Result` objects.
6. **Separation of concerns**: Keep domain logic isolated from frameworks and transport (HTTP, UI, DB).
7. **Make illegal states unrepresentable**: Prefer discriminated unions over flags; avoid `null | undefined` unless meaningful.
8. **Optimize for reading**: Code is read far more than written; favor clarity over cleverness.

---

## 2) Project Structure & Module Boundaries (Vanilla TS + SCSS + ECharts)

**Recommended layout**

```
src/
  app/                 # App bootstrap & composition root (start-up, routing if any)
  domain/              # Pure domain: series, labels, selections, tools, validators
  platform/            # Browser capabilities: storage (IndexedDB), files, SW, clipboard
  charts/              # ECharts setup, typed options, helpers, theme bridge, minimap
  ui/                  # Vanilla TS view layer (DOM utilities, dialogs, panels)
  styles/              # SCSS (7-1-ish): abstracts/, base/, layout/, components/, pages/, themes/
  workers/             # Web workers for heavy ops (downsampling, parsing, exports)
  shared/              # Cross-cutting utils, result types, constants
  test/                # Test helpers, fixtures
```

**Module rules**

- `domain` is **pure**; no DOM, no ECharts, no storage.
- `ui` depends on `domain`, `charts`, and `shared` only (no `platform` calls directly).
- `charts` depends on `shared` and reads theme tokens via the theme bridge; no `ui` imports.
- `platform` depends on `shared` and adapts browser APIs; never import `ui`.
- No cyclic deps. Enforce with ESLint import rules.

**Imports & aliases**

- Named exports only; shallow barrels for `@domain`, `@charts`, `@ui`.
- Path aliases in `tsconfig`/Vite: `@app/*`, `@domain/*`, `@platform/*`, `@charts/*`, `@ui/*`, `@styles/*`, `@shared/*`.

---

## 3) TypeScript Rules of Thumb TypeScript Rules of Thumb

- `strict: true` (see tsconfig below). Always target the latest stable `lib` your runtime supports.
- Prefer **type aliases** for object shapes and unions; use `interface` when extending OO hierarchies or for public APIs that benefit from declaration merging.
- Use **discriminated unions** for state machines and async states (e.g., `{ kind: 'idle' | 'loading' | 'error' | 'success' }`).
- Add **explicit return types** for all exported functions and public class methods.
- Use **generics** to model reusable algorithms; avoid over-generic signatures that weaken type inference.
- Prefer `readonly` arrays/tuples and `Readonly<T>` for inputs.
- Replace enums with union string literals where possible (`type Role = 'admin' | 'user'`).
- Use **type predicates** for custom narrowing: `function isUser(x: unknown): x is User { ... }`.
- Avoid type assertions (`as Foo`) unless interfacing with unsafe third-party code; wrap in safe constructors or codecs.

---

## 4) Error Handling & Logging

- Throw **domain-specific errors** (extending `Error` with `name` and `cause`); avoid throwing strings.
- At boundaries (HTTP handlers, message consumers), map domain errors to transport responses.
- Use a single logging abstraction with levels (`debug`, `info`, `warn`, `error`).
- Never log PII by default; redact tokens and secrets.

**Typed Result pattern (optional):**

```ts
export type Ok<T> = { ok: true; value: T };
export type Err<E extends Error = Error> = { ok: false; error: E };
export type Result<T, E extends Error = Error> = Ok<T> | Err<E>;
```

---

## 5) Async & Concurrency

- Use `async/await`; avoid mixing with `.then()` chains.
- Always `await` promises; never leave floating promises—wrap with `void` only when intentionally fire‑and‑forget and documented.
- Use `Promise.all` for independent operations; use `p-limit` or queues for throttling.
- **Timeouts & abort**: Support `AbortSignal` on long-running ops.

---

## 6) Testing Strategy

- **Unit tests** for pure domain logic (fast, no I/O). 80–90% coverage here.
- **Integration tests** for adapters (HTTP, DB); run in CI.
- **Contract tests** at service boundaries if multiple services interact.
- Avoid fragile UI snapshot tests; test behavior over structure.

Naming: `should_<behavior>_when_<condition>()`.

---

## 7) Documentation & Comments

- JSDoc on public APIs and exported types.
- Document non-obvious invariants and decisions; delete stale comments.
- Keep README focused on running, testing, building, and architecture map.

---

## 8) Tooling: ESLint, Prettier, TSConfig, VS Code

### 8.1 VS Code settings (optional)

`.vscode/settings.json`:

```json
{
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
        "source.fixAll.eslint": true,
        "source.organizeImports": false
    },
    "typescript.preferences.preferTypeOnlyAutoImports": true
}
```

**Scripts** (add to `package.json`):

```json
{
    "scripts": {
        "lint": "eslint .",
        "lint:fix": "eslint . --fix",
        "format": "prettier --write .",
        "typecheck": "tsc -p tsconfig.json --noEmit"
    }
}
```

---

## 9) UI & ECharts (vanilla TS + SCSS)

**View layer (no frameworks)**

- Use small DOM utilities (e.g., `qs`, `on`, `toggleClass`) and event delegation.
- Prefer **composition** over inheritance; each panel/dialog in `ui/` exposes `init(el)`, `render(state)`, and event hooks.
- Keep files ≤200 lines when possible; extract helpers.

**SCSS architecture**

```
src/styles/
  abstracts/   # _variables.scss (maps to CSS vars from THEMING.md), _mixins.scss, _functions.scss
  base/        # resets, typography, base elements
  layout/      # grid, header, sidebar, panels
  components/  # buttons, inputs, toolbars, modals, toasts
  pages/       # page-specific styles
  themes/      # optional theme shims; prefer CSS variables for runtime themes
  main.scss
```

- BEM‑ish naming: `.block__element--modifier`.
- **Never hard‑code colors**; use CSS variables defined by THEMING.md.
- Use container queries where beneficial; otherwise CSS grid + flex.

**ECharts integration**

- Import **only** needed parts of ECharts (modular API) in `charts/`.

```ts
import { init, use } from 'echarts/core';
import { LineChart } from 'echarts/charts';
import {
    GridComponent,
    TooltipComponent,
    DataZoomComponent,
    ToolboxComponent,
    MarkAreaComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
use([
    LineChart,
    GridComponent,
    TooltipComponent,
    DataZoomComponent,
    ToolboxComponent,
    MarkAreaComponent,
    CanvasRenderer,
]);

export function createMainChart(el: HTMLDivElement, themeName: string) {
    const chart = init(el, themeName);
    // setOption(...) elsewhere with typed helpers
    return chart;
}
```

- Provide typed option builders: `buildLineSeries(opts)`, `buildAxesTheme(tokens)`.
- Enable **progressive rendering** and **sampling** for large series; prefer doing heavy downsampling (e.g., LTTB) in a **Web Worker** (see `workers/`).
- Use `dataZoom` (inside + slider) and a **minimap** chart fed from downsampled data.
- Keep chart state in `domain` (selection, cursor, labels), not inside ECharts instances.

**Responsiveness & accessibility**

- Mobile first; breakpoints at \~360px, 768px, 1200px.
- Hit targets ≥44×44 px; no `outline: none`; visible focus states.
- Support keyboard shortcuts with an accessible menu reference.
- Respect prefers-reduced-motion; throttle expensive handlers (`requestAnimationFrame`).

---

## 10) Data & Persistence (Offline‑first) API Layer

- Centralize HTTP client configuration (base URL, interceptors, auth, retries).
- All network functions return typed `Result<T, E>` or throw typed errors; no raw `any`.
- Validate external payloads (zod/io-ts/custom guards) at the edge and map to internal types.

---

## 11) Security & Configuration

- No secrets stored; avoid PII in logs. Redact file names if needed.
- Configuration via a typed config module; read from `import.meta.env` (Vite) when applicable.
- Theming: `THEMING.md` is the **source of truth**. Map theme tokens → CSS variables → ECharts theme object in `charts/themeBridge.ts`.
- Service Worker (if enabled) must respect theme and cache invalidation strategies.

---

## 12) Refactoring Playbook (step‑by‑step) Refactoring Playbook (step‑by‑step)

1. **Stabilize tooling**: Add `tsconfig`, ESLint, Prettier, VS Code settings; run `lint:fix`.
2. **Turn on strictness**: Enable `strict` and progressively add `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
3. **Kill `any`**: Replace with `unknown` and narrow; add type guards.
4. **Tame imports**: Introduce path aliases and auto‑sorted imports.
5. **Extract side effects**: Move I/O out of pure modules; separate domain from adapters.
6. **Normalize errors**: Create domain error types and map at boundaries.
7. **Introduce tests** for domain modules; cover edge cases.
8. **Document decisions**: Add short ADRs (see template) for major changes.

---

## 13) ADR (Architecture Decision Record) Template

```
# ADR <id>: <title>

Date: YYYY-MM-DD
Status: Proposed | Accepted | Superseded by ADR <id>

## Context
What forces are in play? (requirements, constraints)

## Decision
What we decided and why.

## Consequences
Positive/negative outcomes, follow-ups, risks.
```

Store ADRs in `docs/adr/` and keep them short (\~1 page).

---

## 14) Pull Request Checklist

- [ ] Follows project structure & import rules (Section 2).
- [ ] No `any`; exported APIs have explicit return types.
- [ ] Side effects isolated (`platform/`); pure logic unit‑tested.
- [ ] ECharts imports are **modular**; options typed; minimap & dataZoom consistent.
- [ ] SCSS uses tokens/CSS variables from **THEMING.md**; no hard‑coded colors.
- [ ] Layout verified at 360px, 768px, 1200px; focus states visible; hit targets ≥44px.
- [ ] Storage changes include schema version bump & migration (if needed).
- [ ] Lint/format/typecheck/build pass; Vite preview tested offline (if PWA enabled).
- [ ] ADR updated/added when architecture changed.

---

## 15) Prompt Library (copy‑paste into Copilot Chat)

- **Global rewrite**: “Refactor this file to comply with the Engineering Guide (Sections 1–3, 9–11). Remove `any`, add explicit return types, extract side effects to `platform/`, and keep domain logic pure.”

- **Module boundaries**: “List and fix imports violating boundaries (`ui`↔`domain`↔`charts`↔`platform`). Propose file moves and minimal diffs.”

- **ECharts**: “Convert to the modular ECharts API, importing only used components. Add progressive rendering and sampling. Create typed option builders and a minimap per Section 9.”

- **SCSS & theming**: “Restructure styles into the directories in Section 9. Replace hard-coded colors/spacings with CSS variables from THEMING.md. Add container queries for panels.”

- **Responsiveness & a11y**: “Audit for mobile: ensure 44×44 touch targets, visible focus, and keyboard support. Generate a checklist of fixes.”

- **Offline-first**: “Introduce `platform/storage` IndexedDB wrapper with versioned schema and typed migrations. Add export/import and autosave with debouncing.”

- **Workers**: “Move heavy computations (downsampling, parsing) to Web Workers with typed messages and benchmarks.”

- **Vite**: “Add/adjust `vite.config.ts` aliases and SCSS globals; ensure build target es2022 and sourcemaps on. Propose PWA setup if desired.”

- **Tests**: “Generate unit tests for pure domain functions and integration tests for storage adapter.”

- **Docs**: “Add/refresh short JSDoc for exported APIs and a quickstart for local‑only data workflow.”

---

## 16) Conventional Commits (optional but recommended) Conventional Commits (optional but recommended)

Use `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`. Include `BREAKING CHANGE:` footer for breaking API changes. Pair with Changesets to automate versions/changelogs.

---

## 17) Quick Reference

- **Never** ship `any` (use `unknown` + guards).
- **Always** explicit return types on exports.
- **Prefer** small pure functions; extract side effects.
- **Enforce** via ESLint + Prettier + strict TS.
- **Document** big decisions with ADRs.

---

_End of guide._
