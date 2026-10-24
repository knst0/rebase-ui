---
"@rebase-ui/reze": patch
---

Create the `Avatar.Image` element once. A sibling `Avatar.Fallback` shares one render effect with it, so every loading status change used to rebuild the `<img>`, which looped endlessly while the browser cache was bypassed.
