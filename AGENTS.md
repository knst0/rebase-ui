# Agent Instructions

@PORT_FIDELITY.md

## Context

Follow these core principles when contributing to the repository.
Always read `PORT_FIDELITY.md` before porting or modifying a component.

## System Goals

- **Port Fidelity**: Maintain a high level of fidelity in porting components from Base UI to Solid JS 2.0. Ensure that the functionality, accessibility features, and interactive states are preserved exactly.
- **Layer Separation**: Keep `packages/solid` as pure, headless primitives (focus on logic and accessibility).

## Core Directives

- Use **Solid JS 2.0** for all reactivity logic.
- Implement high-performance components by following Solid best practices to minimize unnecessary reactivations.
- Ensure full accessibility compliance using WAI-ARIA standards in `packages/solid`.
- Follow the established design system of Base UI when drafting new features or modifications.

## Solid 2.0 Reactivity (Strict Mode)

Deviate from these and the dev console emits `STRICT_READ_UNTRACKED` (a read that got a one-time value and will never update):

- **`<For>` mappers are untracked**: never call signal accessors (e.g. `index()`) directly in the mapper. Resolve them inside a per-row `createMemo` and read the memo from JSX.
- **Split effects `createEffect(compute, apply)`**: the apply callback is untracked. Every reactive value it needs must be read in the compute function and passed through its return value.
- **Intentional one-shot reads** (effect applies, event handlers, timeouts, deferred microtasks): use `store.peek()` / `peekState()` for store state and plain `untrack()` for signals — a bare `untrack(fn)` with no label is the sanctioned escape hatch and does not warn.
- **`stableCallback` reads the handler signal at call time**: invoking it from an effect apply warns — wrap the call in `untrack`.
- **Warning location misleads**: a `store.select()` in an apply warns at the store's internal version-signal line (e.g. `trackKey`), not the call site. Always get the full console text first — it carries the owner path (`in <App> › … › effect`) naming the offending component. In tests, `OBSERVE.diagnostics.capture()` from `solid-js` gives exact attribution (`ownerPath`, `nodeName`).
- **Regression pattern**: capture `console.warn`/`console.error`, drive open/filter/select/clear interactions, assert zero `STRICT_READ_UNTRACKED` (see `DialogRoot.test.tsx`, `ComboboxListDiagnostics.test.tsx`).

## Development Workflow

- **Package Management**: Use `pnpm` for all package management and installation tasks.
- **Linting & Formatting**: Utilize `oxlint` and `oxfmt` to maintain consistent code quality across the monorepo.
- **Testing Strategy**: Implement unit tests in `vitest` and perform end-to-end (E2E) testing with `playwright`.
- **Build Step**: Use `tsdown` for production builds and bundling.

## Key Modules

1.  **Core (`packages/solid`)**: The foundation of the library; contains all primitive components, headless logic, and shared utilities.
