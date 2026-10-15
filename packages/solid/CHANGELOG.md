# @rebase-ui/solid

## 0.15.0

### Minor Changes

- 49b8bf0: Add filterable menus ported from Base UI v1.9.0 (#5527): new `Menu.FilterProvider`, `Menu.Input`, `Menu.List`, `Menu.Empty`, and `Menu.Clear` parts with item registry, label resolution, keyboard navigation, empty-state handling, and WebKit `aria-selected` compatibility (#5868, #5840).

### Patch Changes

- 49b8bf0: Sync primitives with Base UI v1.9.0: accordion trigger `data-index` and shared state mapping (#5705); disabled-trigger focusability (#5607); collapsible `hidden="until-found"` reveal handling (#5514, #5890, #5891); `aria-label` support in labelled-by resolution (#5787); radio group ref forwarding (#5775); shadow-DOM label lookup (#5871); field focus ownership with reset on disable (#5345); scroll area viewport role (#5813); toast timer resume (#5809); number field scrub click (#5889); OTP IME composition (#5098); slider cancel/pointer gestures and single-value arrays (#5639, #5779, #5781); dismiss and animation-runner fixes (#5780, #5865, #5719); trigger-switch transitions (#4261); popup focus guards (#5733); popup mount/transition status (#5738); menu press, submenu, typeahead, and composite fixes (#5789, #5793, #5824, #5816, #5819); select/combobox `preventUnmountOnClose` and `close` action (#5734); combobox highlight/query fixes (#5818, #5879); highlight event details (#5838); readonly input value types (#5710); select store props (#5589); shared item indicator (#5728); drawer swipe, scrollable, CloseWatcher, and virtual-keyboard fixes (#5658, #5845, #5844, #5864, #5808, #5770, #5768, #5769, #5774, #5882); data-attribute and CSS-variable namespace exports (#5243); fieldset legend data-attributes export (#5901).
- 3a55f10: Persist `data-starting-style` on closed `hiddenUntilFound` collapsible and accordion panels (upstream `shouldPersistHiddenTransitionStyles`), so find-in-page reveals never flash at full height before the open commits. Docs API tables now render `@type` tags from data-attribute definitions (e.g. accordion trigger `data-index` shows `number`).
- 4de1e1d: Publish `@rebase-ui/core`, a framework-free package with utilities shared by `@rebase-ui/solid` (slider math, number field parsing, select item equality, scroll edges). `@rebase-ui/solid` now depends on it; public exports are unchanged.
- Updated dependencies [4de1e1d]
  - @rebase-ui/core@0.15.0

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
