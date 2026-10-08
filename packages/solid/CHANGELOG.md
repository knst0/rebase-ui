# @rebase-ui/solid

## 0.14.3

### Patch Changes

- feb2eb7: AvatarImage writes its loading status straight into the Avatar root signal instead of relaying it through an effect. The root and fallback now see each status change in the same flush, removing the one-flush lag that Solid reports as `EFFECT_RELAY_TEAR`.

## 0.14.2

### Patch Changes

- 6b5c01d: Keep server rendering free of signal writes. Triggers (Menu, Submenu, Popover, PreviewCard, Tooltip) no longer push interaction props from the component body on the server, `createAriaLabelledBy` skips its DOM-derived fallback there, and AvatarImage, Select scroll arrows, Combobox items, popup viewports and synced popup interaction props no longer write their stores while a server render is disposed. Solid 2 reports each of these as `SERVER_WRITE` and will turn them into errors.

## 0.14.1

### Patch Changes

- 0abb064: Bundle the `solid` export condition per subpath with shared chunks instead of one file per source module. Vite never pre-bundles `solid`-condition packages, so the unbundled tree cost the consumer's dev server about 500 module requests on first load; the bundled tree is under 100.

## 0.14.0

### Minor Changes

- d243b50: Publish uncompiled JSX under the `solid` export condition (`dist/solid/**/index.jsx`) next to the existing compiled `default` build. Bundlers with the Solid plugin resolve it and compile the components themselves, so server rendering and hydration work: the `default` build is DOM-only and throws `Client-only API called on the server side` during SSR.

## 0.13.1

### Patch Changes

- 352daf7: Fix modal focus containment for Dialog and Drawer, including nested traps, portaled descendants, and focus restoration when kept-mounted popups close and reopen.
- 352daf7: Keep Checkbox and Radio native inputs consistent with committed state when a change is canceled or a controlled value is not updated. Checkbox exposes field invalidity on the accessible control, and NumberField preserves an explicit `aria-labelledby` over its field label.
- 352daf7: Preserve stateful Popover children while keeping returned provider and portal accessors reactive, so choosing a nested Select option does not remount the Select or dismiss its parent.
- 352daf7: Run browser/docs tests with `pnpm test:ci` and filesystem package contracts with `pnpm test:package`, which builds the library before testing its exports in Node. CI uses both gates; `pnpm typecheck` now checks the library and docs projects rather than an empty root project.
