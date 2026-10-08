---
"@rebase-ui/solid": minor
---

Publish uncompiled JSX under the `solid` export condition (`dist/solid/**/index.jsx`) next to the existing compiled `default` build. Bundlers with the Solid plugin resolve it and compile the components themselves, so server rendering and hydration work: the `default` build is DOM-only and throws `Client-only API called on the server side` during SSR.
