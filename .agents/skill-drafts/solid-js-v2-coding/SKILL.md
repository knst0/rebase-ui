---
name: solid-js-v2-coding
description: Write idiomatic SolidJS 2.0 code using fine-grained reactivity, signals, and function components.
---

# SolidJS 2.0 Coding

Use this skill when writing, editing, or reviewing SolidJS 2.0 code.
Source: `next` branch `documentation/solid-2.0/MIGRATION.md`. If memory conflicts with that guide, follow the guide.

## Imports and JSX types

Write 2.0 import paths directly:

```ts
import { render, hydrate } from "@solidjs/web";
import { createStore, reconcile, snapshot, storePath } from "solid-js";
import h from "@solidjs/h";
import html from "@solidjs/html";
import { createRenderer } from "@solidjs/universal";
```

Never write `solid-js/web`, `solid-js/store`, `solid-js/h`, `solid-js/html`, or `solid-js/universal`.
Web `tsconfig.json` uses `"jsx": "preserve"` with `"jsxImportSource": "@solidjs/web"`.
Import web JSX types from `@solidjs/web`, not `solid-js`:

```ts
import type { JSX, ComponentProps } from "@solidjs/web";
import type { Component, Element } from "solid-js";
```

## Signals, batching, memos

Writes are microtask-batched. A setter is not visible to reads until flush:

```js
setCount(1);
count(); // still old value
flush(); // catch up now
count(); // new value
```

Use `flush()` only in tests or rare imperative settle points.
`createSignal(fn)` is a writable derived signal; `createStore(fn, seed)` is a derived store.
`createMemo` takes no initial-value argument; `prev` is `undefined` on first run.

## Effects and lifecycle

Write split effects (compute -> apply). Return cleanup from the apply side:

```js
createEffect(
  () => name(),
  (value) => {
    el().title = value;
  },
);

createEffect(
  () => name(),
  (value) => {
    const id = setInterval(() => console.log(value), 1000);
    return () => clearInterval(id);
  },
);
```

Do not use single-function effects with `onCleanup` for the common case.
`onMount` is gone — write `onSettled`, which may return cleanup:

```js
onSettled(() => {
  measureLayout();
  window.addEventListener("resize", measureLayout);
  return () => window.removeEventListener("resize", measureLayout);
});
```

Never write signals/stores inside a memo/effect tracking scope. Derive with `createMemo`; write in event handlers and actions. Never read reactive values at component top level or destructure props:

```jsx
function Ok(props) {
  return <div>{props.count}</div>;
}
```

## Async data

Write `Loading` / `Errored`, not `Suspense` / `ErrorBoundary`:

```jsx
<Loading fallback={<Spinner />}>
  <Profile user={user()} />
</Loading>
```

Write async memos, not `createResource`:

```js
const user = createMemo(() => fetchUser(id()));
```

Use `isPending(() => expr)` for in-flight indicators and `refresh(target)` plus `affects()` for refetches. A bare `refresh()` is silent. Wrap mutations in `action(...)` with optimistic stores, then `refresh(...)`.

`SuspenseList` is `Reveal`:

```jsx
<Reveal>
  <Loading fallback={<Skeleton />}>
    <Header />
  </Loading>
  <Loading fallback={<Skeleton />}>
    <Posts />
  </Loading>
</Reveal>
```

## Stores and props helpers

Prefer draft-first setters; `produce` is the default and is not imported:

```js
setStore((s) => {
  s.user.address.city = "Paris";
  s.list.push("item");
});
```

Use `snapshot(store)` for plain values, never `unwrap`. Use `storePath(...)` only for old path-style ergonomics. Write `merge` (not `mergeProps`) and `omit(props, "class", "style")` (not `splitProps`). `undefined` overrides in `merge`; it does not mean skip.

## Control flow and components

`Index` is gone. Write `<For keyed={false}>` with an item accessor:

```jsx
<For each={items()} keyed={false}>
  {(item, i) => <Row item={item()} index={i} />}
</For>
```

Default `For` receives raw items; `keyed={false}` receives item accessors plus a stable numeric index. Prefer `<Dynamic>` or the `dynamic(() => Comp)` factory over manual component switching.

Context is its own provider:

```jsx
const Theme = createContext("light");
<Theme value="dark">{props.children}</Theme>;
```

A default-less `createContext<T>()` throws `ContextNotFoundError` when missing; do not add undefined-check wrapper hooks.

## DOM and refs

Do not write `/*@once*/`, `use:`, `attr:`, `bool:`, `on:`, `oncapture:`, `classList`, or `class:` / `style:` namespaces. Write normal reactive JSX, `class` object/array forms, lowercase attributes, and `onClick`-style handlers:

```jsx
<div class={["card", { active: isActive() }]} />
<video muted={false} />
```

Ref callbacks are unowned (`getOwner()` is `null`). Keep lifecycle in `onSettled` or a directive factory; write reusable directives as `ref` factories with owned setup and unowned apply:

```jsx
<button ref={tooltip({ content: "Save" })} />
<button ref={[autofocus, tooltip({ content: "Save" })]} />
```
