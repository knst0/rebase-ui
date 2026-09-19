---
"@rebase-ui/solid": patch
---

Release `actionsRef` when `Form` and `Field.Root` unmount. Both registered the actions object from a split effect's apply callback and released it with `onCleanup`, which is unowned there and never ran, so the consumer's setter kept a handle to a disposed field or form. The release is now the effect's returned cleanup.

Stop reading reactive state outside tracking scopes in transition-completion and imperative paths. `runOnOpenChangeComplete` invokes `onComplete` untracked — it runs inside the effect phase and in later animation continuations, where a read cannot subscribe — which covers `Avatar.Image`, `Tabs.Panel`, `Field.Error`, `Radio.Indicator`, `Combobox.Clear`, the select scroll arrows and the item indicators. `Combobox.Item`'s value-registry sync, `Combobox.Popup`'s `returnFocus` resolution, `Popover.Trigger`'s focus guards and `Slider.Thumb`'s inset measurement snapshot their reads the same way. Dev builds no longer emit `STRICT_READ_UNTRACKED` for these paths.
