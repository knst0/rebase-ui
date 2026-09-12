---
name: port-component
description: Port a Base UI component to Solid with full fidelity, docs, and tests.
---

# Port Component

Port one Base UI (React) component to `packages/solid` as a headless Solid primitive.

## Before writing code

1. Read `AGENTS.md` and `PORT_FIDELITY.md` in the workspace root.
2. Fetch the upstream source (`mui/base-ui` repo, `packages/react/src/<component>/`) and the upstream docs page plus all demos (`docs/src/app/(docs)/react/components/<component>/`).

## Port rules

- Keep `packages/solid` headless: logic and WAI-ARIA accessibility only, no visual styling.
- Solid JS 2.0 reactivity: make state-describing props (open, disabled, value) reactive; read structural/config props (`as`, `id`, `defaultValue`, `orientation` when static) once via `untrack`. Use two-arg `createEffect`; Solid prop names (`for`, `tabindex`).
- **Styles must use kebab-case keys** (`inset-inline-start`, `z-index`, `writing-mode`). Solid applies object styles via `CSSStyleDeclaration.setProperty`, which silently drops camelCase names such as `insetInlineStart`. SSR also emits keys verbatim, so camelCase breaks server-rendered HTML too.
- Mirror the upstream file layout (`root/`, per-part dirs, `*DataAttributes.ts`, `index.parts.ts`) and reuse `RenderElement`, `split`, and shared utils. Do not invent divergent API shapes.

## Docs

- Docs pages must carry the exact upstream content: all sections, examples, and code samples, with only mechanical Solid adaptations (`class`, `@rebase-ui/solid` imports, React→Solid wording, local link paths).
- Port every upstream demo (tailwind variants) to `docs/src/routes/(main)/components/<component>/_demos/<name>.tsx`, referenced via `<Demo <name> />`. Use `<For>` instead of `.map` with `key`, and `aria-hidden="true"` instead of valueless `aria-hidden`, to satisfy Solid 2 types.
- Page body and demos are updated together, never separately.

## Tests and verification

- Add focused `vitest` tests beside the ported code, including style-positioning assertions via `getPropertyValue` with kebab-case names, plus edge and interaction paths.
- Verify with Node 26 from fnm, then report observed results: full-suite `vitest run`, `tsc --noEmit` (per-package projects), `oxlint --type-aware --type-check`, and a docs `vite build`.
