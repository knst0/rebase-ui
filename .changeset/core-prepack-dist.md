---
"@rebase-ui/core": patch
"@rebase-ui/reze": patch
"@rebase-ui/solid": patch
---

Ship `@rebase-ui/core` with its built `dist`: the 0.1.0 tarball published
without any modules because the package lacked the `prepack` hook that
`@rebase-ui/reze` and `@rebase-ui/solid` already run during publish.
Consumers pin the fixed version.
