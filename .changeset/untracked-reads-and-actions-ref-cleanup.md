---
"@rebase-ui/solid": patch
---

Release `actionsRef` when `Form` and `Field.Root` unmount. Both registered the actions object from a split effect's apply callback and released it with `onCleanup`, which is unowned there and never ran, so the consumer's setter kept a handle to a disposed field or form. The release is now the effect's returned cleanup.

Stop reading reactive state outside tracking scopes in transition-completion and imperative paths. `runOnOpenChangeComplete` invokes `onComplete` untracked — it runs inside the effect phase and in later animation continuations, where a read cannot subscribe — which covers `Avatar.Image`, `Tabs.Panel`, `Field.Error`, `Radio.Indicator`, `Combobox.Clear`, the select scroll arrows and the item indicators. `Combobox.Item`'s value-registry sync, `Combobox.Popup`'s `returnFocus` resolution, `Popover.Trigger`'s focus guards and `Slider.Thumb`'s inset measurement snapshot their reads the same way. Dev builds no longer emit `STRICT_READ_UNTRACKED` for these paths.

Fix modal focus containment for Dialog and Drawer, including nested traps, portaled descendants, and focus restoration when kept-mounted popups close and reopen.

Keep Checkbox and Radio native inputs consistent with committed state when a change is canceled or a controlled value is not updated. Checkbox exposes field invalidity on the accessible control, and NumberField preserves an explicit `aria-labelledby` over its field label.

Preserve stateful Popover children while keeping returned provider and portal accessors reactive, so choosing a nested Select option does not remount the Select or dismiss its parent.

Run browser/docs tests with `pnpm test:ci` and filesystem package contracts with `pnpm test:package`, which builds the library before testing its exports in Node. CI uses both gates; `pnpm typecheck` now checks the library and docs projects rather than an empty root project.
