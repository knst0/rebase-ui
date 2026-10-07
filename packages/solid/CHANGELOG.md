# @rebase-ui/solid

## 0.13.1

### Patch Changes

- 352daf7: Fix modal focus containment for Dialog and Drawer, including nested traps, portaled descendants, and focus restoration when kept-mounted popups close and reopen.
- 352daf7: Keep Checkbox and Radio native inputs consistent with committed state when a change is canceled or a controlled value is not updated. Checkbox exposes field invalidity on the accessible control, and NumberField preserves an explicit `aria-labelledby` over its field label.
- 352daf7: Preserve stateful Popover children while keeping returned provider and portal accessors reactive, so choosing a nested Select option does not remount the Select or dismiss its parent.
- 352daf7: Run browser/docs tests with `pnpm test:ci` and filesystem package contracts with `pnpm test:package`, which builds the library before testing its exports in Node. CI uses both gates; `pnpm typecheck` now checks the library and docs projects rather than an empty root project.
