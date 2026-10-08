---
"@rebase-ui/solid": patch
---

Keep server rendering free of signal writes. Triggers (Menu, Submenu, Popover, PreviewCard, Tooltip) no longer push interaction props from the component body on the server, `createAriaLabelledBy` skips its DOM-derived fallback there, and AvatarImage, Select scroll arrows, Combobox items, popup viewports and synced popup interaction props no longer write their stores while a server render is disposed. Solid 2 reports each of these as `SERVER_WRITE` and will turn them into errors.
