import type { JSX, ComponentProps } from "@solidjs/web";
import { createContext, omit, Show, useContext } from "solid-js";
import { highlight } from "sugar-high";
import { lang } from "sugar-high/lang";

import type { RehypeCodeValuePreProps } from "../../plugins";
export type Context = {
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
          <code innerHTML={highlight(props.value as string, { lang: lang(props.language as string) ?? "typescript" })} />
        </pre>
      </div>
    );
  },
  code: (props) => <code class="bg-gray-1 border-gray-6 rounded border px-1 py-0.25 text-sm" {...props} />,
};

const Context = createContext<Context>(DEFAULT_VALUE);

export const useMDXComponents = () => useContext(Context);
