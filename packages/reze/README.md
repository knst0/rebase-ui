# @rebase-ui/reze

Headless, accessible UI primitives for [Reze.js](https://github.com/knst0/reze-js), ported from Base UI. This package is pre-release: all 32 component entrypoints are ported (`accordion`, `alert-dialog`, `avatar`, `button`, `checkbox`, `checkbox-group`, `collapsible`, `combobox`, `dialog`, `drawer`, `field`, `fieldset`, `form`, `input`, `menu`, `meter`, `number-field`, `otp-field`, `popover`, `preview-card`, `radio`, `radio-group`, `scroll-area`, `select`, `separator`, `slider`, `switch`, `tabs`, `toast`, `toggle`, `toggle-group`, `tooltip`).

## Status

All 32 upstream component entrypoints are ported with tests. The port pattern (reactive prop reads inline in JSX bindings, stable per-event handlers over the live props object, `dynamicElement` for `as`) is documented in the port notes below.

Dialog adds three rules the port relies on: children getters are read once per component body (re-reading them per binding run would recreate child components); zero-argument function children pass through to the renderer untouched (control-flow primitives return thunks, not render props); store mutations inside effects are wrapped in `untrack` so actions never subscribe to the counters they write.

## Dependency on Reze

`reze-js`, `@rezejs/vite-plugin`, and `@rezejs/testing-library` are regular npm
dev dependencies on published packages (`reze-js >=0.1,<1` as the peer range).
The test config resolves them through `node_modules`, so no aliased sibling
checkout is involved.

## Consuming the library

The library ships Reze source. The consumer's build resolves the `reze` export condition and compiles it; `reze.json` carries the cross-module facts so consumers do not need `analyze`. Regenerate it after changing `src`:

```sh
pnpm --filter @rebase-ui/reze manifest
```

Until the Vite plugin skips `reze`-condition packages during dependency optimization, consumers must exclude this package in dev:

```ts
export default defineConfig({
  plugins: [reze()],
  optimizeDeps: { exclude: ["@rebase-ui/reze"] },
});
```

Production builds need no extra configuration.

## Port notes (Solid → Reze)

- State-describing props (`disabled`, `focusableWhenDisabled`) are read directly in JSX bindings or at event time. Structural props (`as`, `nativeButton`) follow the same code path; `as` switches through `dynamicElement`.
- Component `state` passed to `class`/`style`/`children` render functions is a plain snapshot (`{ disabled: boolean }`), matching upstream React. Bindings re-evaluate when the props they read change.
- Internal button attributes win over same-named forwarded props (`type`, `role`, `tabindex`, `aria-disabled`, `disabled`, `data-disabled`).
- `data-*` state attributes are bound explicitly in JSX; there is no `RenderElement`/`stateAttributesMapping` layer.
- Prop splitting uses `omitProps` from `reze-js`; there is no `split` helper.
- `filter-dropdown` is internal-only (no package export), matching upstream.
