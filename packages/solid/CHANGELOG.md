# @rebase-ui/solid

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
