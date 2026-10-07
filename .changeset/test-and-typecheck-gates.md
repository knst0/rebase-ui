---
"@rebase-ui/solid": patch
---

Run browser/docs tests with `pnpm test:ci` and filesystem package contracts with `pnpm test:package`, which builds the library before testing its exports in Node. CI uses both gates; `pnpm typecheck` now checks the library and docs projects rather than an empty root project.
