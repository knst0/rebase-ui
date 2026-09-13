---
"@rebase-ui/solid": patch
---

Keep the popup subtree mounted when the active trigger's payload changes. `Tooltip.Root`, `Popover.Root`, `PreviewCard.Root`, `Dialog.Root` and `AlertDialog.Root` now invoke render-prop children once and expose `payload` as a reactive getter, so switching between detached triggers updates the content in place instead of recreating the positioner, popup and viewport. The positioner glides to the new anchor, the popup animates its width/height, and `Viewport` keeps the outgoing `[data-previous]` snapshot for the directional slide.

Read `payload` inside JSX (`{root.payload}`), not by destructuring the argument: a destructured value is captured once and will not update.
