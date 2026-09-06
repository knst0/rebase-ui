import { Meta, Title } from "@solidjs/meta";
import type { JSX, ComponentProps } from "@solidjs/web";
import { createContext, omit, Show, useContext } from "solid-js";

import type { RehypeCodeValuePreProps } from "../../plugins";
import { highlightCode } from "../../plugins/highlightCode";
import { ApiReference } from "./ApiReference";
import { Demo } from "./Demo";
import { ReferenceTable } from "./ReferenceTable";
import { TypePopover } from "./TypePopover";

export type Context = Record<string, ((props: never) => JSX.Element | JSX.Element[]) | undefined> & {
  [T in keyof JSX.IntrinsicElements]?: (props: ComponentProps<T>) => JSX.Element | JSX.Element[];
};

const DEFAULT_VALUE: Context = {
  h1: (props) => (
    <h1 id={props.id} class="mb-4 text-3xl font-semibold" style="scroll-margin-top: 32px;">
      <a href={`#${props.id}`}>{props.children}</a>
    </h1>
  ),
  h2: (props) => {
    return (
      <h2 id={props.id} class="mt-12 mb-4 block text-xl font-semibold" style="scroll-margin-top: 32px;">
        <a href={`#${props.id}`}>{props.children}</a>
      </h2>
    );
  },
  h3: (props) => {
    return (
      <h3 id={props.id} class="mt-12 mb-3 block font-semibold" style="scroll-margin-top: 32px;">
        <a href={`#${props.id}`}>{props.children}</a>
      </h3>
    );
  },
  p: (props) => <p class="text-fg/70 mb-4" {...props} />,
  pre: (props: ComponentProps<"pre"> & RehypeCodeValuePreProps) => {
    const rest = omit(props, "language", "value", "title");
    return (
      <div class="squircle border-border bg-bg-code my-4 max-w-full overflow-x-auto rounded-lg border shadow">
        <Show when={props.title}>
          <div class="border-border flex h-9 items-center justify-between border-b pr-1.5 pl-3">
            <span textContent={props.title as string} class="text-fg/70 text-sm" />
          </div>
        </Show>
        <pre class="w-max min-w-full p-4 text-sm" {...rest}>
          <code innerHTML={highlightCode(props.value as string, { language: props.language })} />
        </pre>
      </div>
    );
  },
  code: (props) => <code class="border-border rounded border px-1 py-0.25 text-sm" {...props} />,
  a: (props) => <a class="text-accent underline underline-offset-2" {...props} />,
  ul: (props) => <ul class="text-fg/70 mb-4 list-disc space-y-1 pl-5" {...props} />,
  ol: (props) => <ol class="text-fg/70 mb-4 list-decimal space-y-1 pl-5" {...props} />,
  li: (props) => <li {...props} />,
  strong: (props) => <strong class="text-fg font-semibold" {...props} />,
  em: (props) => <em {...props} />,
  blockquote: (props) => <blockquote class="border-border text-fg/60 my-4 border-l-2 pl-4" {...props} />,
  hr: (props) => <hr class="border-border my-8" {...props} />,
  h4: (props) => <h4 id={props.id} class="mt-8 mb-2 block font-semibold" style="scroll-margin-top: 32px;" {...props} />,
  Meta,
  Title,
  Demo,
  ReferenceTable,
  ApiReference,
  TypePopover,
};

const Context = createContext<Context>(DEFAULT_VALUE);

export const useMDXComponents = () => useContext(Context);
