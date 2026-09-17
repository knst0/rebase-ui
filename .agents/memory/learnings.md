---
type: reference
---

# rebase-ui Base-UI → Solid 2 port playbook (distilled from 13 project sessions, 2026-09-12/13)

## Pre-port (saves rework)

- Load `port-component` + `solid-js-v2-coding` skills; read `AGENTS.md` + `PORT_FIDELITY.md`.
- Fetch upstream `mui/base-ui` `packages/react/src/<component>/` + docs page + ALL demos; pin v1.8.0 (unpinned fetch 404'd once).
- Mirror upstream layout (`root/`, per-part dirs, `*DataAttributes.ts`, `index.parts.ts`); reuse `RenderElement`, `split`, shared utils. `useX` → `createX`, except context accessors keep `useX`. Positioning via `@floating-ui/dom`, not React binding.
- Big ports (floating: 46 files) split into sequential groups (utils/types → tree/stores → portal/focus → core → interactions); huge single-shot ports hit model idle timeouts.

## Solid 2 reactivity (top repeat-error cluster)

- `onMount` is gone → `onSettled` (may return cleanup). Single-arg `createEffect` throws `MISSING_EFFECT_FN` → split compute→apply form. `onCleanup` inside `onSettled` unsupported → return cleanup fn.
- Component body is NOT a tracking scope: one-time snapshots get `untrack()` or they warn `STRICT_READ_UNTRACKED` (35 warnings from one line in ScrollAreaContent).
- `select()` only in tracking scopes (effect compute, JSX, memo). One-shot reads in handlers/timeouts/emitter-listeners/apply-callbacks → `peek()`/`peekState()` (never subscribe). Store = sync plain-object `snapshot` (source of truth) + per-key version signals + tracking-proxy; single shared version signal = `HUGE_FAN_OUT` (~2500 subs woken per write). Writers bump only changed keys. Reads in `select`/accessors must come from `snapshot`, not signals.
- No `{ current }` wrappers: mutable interaction state → plain `let` + getter/setter accessors in context (primitives copy on put, so expose closures, not values). Element refs → `createSignal` pairs, setters used directly as `ref` callbacks. Never destructure props; state-describing props (open/disabled/value) reactive, structural/config (`as`,`id`,`defaultValue`,`keepMounted`,`orientation` static) via `untrack` once. `flush()` only in tests/settle points.

## Styles / RenderElement (second cluster)

- Style objects MUST use kebab-case (`z-index`, `inset-inline-start`); Solid uses `setProperty`, silently drops camelCase; SSR emits keys verbatim.
- Numbers need units: return `"10px"` strings (only `0` is valid unitless). Merged `style` must be a getter re-reading layers (memoized stable ref swallows signal updates). `combineLayers` deep-merges object styles per-property (later wins); string styles last-wins. Test positions via `getPropertyValue('kebab-name')`.

## API mapping (caught by tsc/lint repeatedly)

- Drop `defaultTriggerId` (`createUniqueId` covers SSR). `Ref<T>` → bare `T`. `RegistrationSource` → `object`. `actionsRef` → `Setter<Actions|null>` (set in `onSettled`/effect, `null` in cleanup). `DialogFocusTarget` without `{current}`. Controlled `open` flows as `ReactiveBoolean` accessor (direct store writes lose to owner sync).
- JSX: `<For>` not `.map`+key; `aria-hidden="true"` not valueless; `class=` not `className`; `merge` not `mergeProps`; `omit(props,...)` not `splitProps`; `snapshot(store)` not `unwrap`; `Loading`/`Errored`/`Reveal`, async memos, `isPending`/`refresh`. Imports from `@solidjs/web` + `solid-js` (never `solid-js/web`, `solid-js/store`).

## Docs + tests

- Docs pages carry exact upstream content (only mechanical Solid adaptations); page body + all `_demos/` updated TOGETHER; `<Demo name/>` per-directory. Demos use `createSignal`/`createUniqueId`, ref-objects for `initialFocus`.
- Tests live beside code per subcomponent (like `DialogRoot.test.tsx` 14 + `DialogPopup.test.tsx` 6); focused vitest suites incl. style-positioning + edge/interaction paths.

## Verification gates (observed)

- `pnpm test:chromium` (== `cross-env VITEST_ENV=chromium pnpm test:unit`); `tsc --noEmit` (root config is `files:[]` — run per-package gate, it catches real errors); `oxlint --type-aware --type-check`; `oxfmt`; docs `vite build`. Engines say Node 24.
- Env quirks: Solid resolves to server build → `resolve.conditions: ["development","browser"]` in `vitest.shared.mts` or `<Portal>` imports flake (~25%). Stale Vite pre-bundle → delete `docs/node_modules/.vite` + restart dev server. `Client-only API called on server` flake = worker loaded server build → rerun. Chromium gate blocked here (no `libnspr4.so`, no package manager) → jsdom baseline; known jsdom-only reds, NOT regressions: avatar image-load timeouts (~10), 1 switch assertion, tooltip safePolygon zero-rects + function-children trigger wiring (need chromium).
- Tooling: `edit_file` needs byte-exact `find` (closest-match failures at 0.98 score still fail — re-read region first). Workspace root is `/root/code/solid/rebase-ui` (paths outside it fail). Wrong-path guesses (`floating-ui-react/store/...`, `internals/render-element.tsx`) cost turns — `ls` first.

## Shipped state (don't re-port)

- dialog + alert-dialog (26→28 tests), floating internals (46 files, 51 tests), tooltip fixes (peek + per-key versions), scroll-area + slider `{current}` removal (121 tests). Popover was in progress. Pre-existing reds baseline: ~11 avatar/switch failures.
