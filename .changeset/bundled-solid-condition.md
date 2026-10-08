---
"@rebase-ui/solid": patch
---

Bundle the `solid` export condition per subpath with shared chunks instead of one file per source module. Vite never pre-bundles `solid`-condition packages, so the unbundled tree cost the consumer's dev server about 500 module requests on first load; the bundled tree is under 100.
