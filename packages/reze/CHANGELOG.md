# @rebase-ui/reze

## 0.1.3

### Patch Changes

- cb990c7: Create the `Avatar.Image` element once. A sibling `Avatar.Fallback` shares one render effect with it, so every loading status change used to rebuild the `<img>`, which looped endlessly while the browser cache was bypassed.

## 0.1.2

### Patch Changes

- 278482f: Ship `@rebase-ui/core` with its built `dist`: the 0.1.0 tarball published
  without any modules because the package lacked the `prepack` hook that
  `@rebase-ui/reze` and `@rebase-ui/solid` already run during publish.
  Consumers pin the fixed version.
- Updated dependencies [278482f]
  - @rebase-ui/core@0.1.1

## 0.1.1

### Patch Changes

- c229ae7: Start publishing `@rebase-ui/core` from `0.1.0`. Core is a framework-free
  package of utilities shared by `@rebase-ui/solid` and `@rebase-ui/reze`
  (slider math, number field parsing, select item equality, scroll edges).
  `@rebase-ui/solid` and `@rebase-ui/reze` pin the new version or newer.
- Updated dependencies [c229ae7]
  - @rebase-ui/core@0.1.0

## 0.1.0

### Minor Changes

- 3a55f10: Pilot the Reze port: package scaffold with the `reze` export condition and manifest, plus the Button primitive.
- 3a55f10: Port the Dialog and AlertDialog primitives: open/controlled state, trigger/popup/backdrop/close/title/description/portal/viewport parts, focus trap, scroll lock, transitions, Escape/outside-press dismissal, handles, and nested dialogs.

### Patch Changes

- Updated dependencies [4de1e1d]
  - @rebase-ui/core@0.15.0
