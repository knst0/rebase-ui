---
"@rebase-ui/solid": patch
---

Fix combobox interactions that never reached the DOM.

`RenderElement` froze a function prop source's key set at its first evaluation, so props a layer published later — the interaction props the combobox store syncs from an effect — were dropped forever. The input therefore rendered without `role="combobox"`, `aria-expanded` or any of the click/keyboard/dismiss handlers, and pressing it did not open the popup. Function layers are now read through a proxy that re-reads their keys, while key probes track only a key signature so a layer reading one prop does not subscribe to unrelated layers.

Also fixed in the combobox:

- `Combobox.Item` and `Combobox.List` attached their capture-phase listeners through React-style `onPointerDownCapture` / `onKeyDownCapture` props. Solid binds those names as literal `pointerdowncapture` events that never fire, so a press committed twice in `multiple` mode (once on `mouseup`, once on `click`) and toggled the item straight back off. They are now registered imperatively with `capture: true`.
- `Combobox.Value` re-invoked its render-prop children on every selection change, recreating the chips and the input and dropping focus. The children function now runs once and receives the selected value as an accessor: read it as `value()` inside the returned JSX.
- `Combobox.GroupLabel` cleared its label id from a cleanup that writes the group's signal, which halted the reactive system (`REACTIVE_WRITE_IN_OWNED_SCOPE`) as soon as filtering unmounted a group. The group signal now allows owned writes.
- `Combobox.List` and `Combobox.Collection` type their function child's item as `any`, matching upstream, so a call site can annotate the item type.
