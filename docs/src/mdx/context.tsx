import { Meta, Title } from "@solidjs/meta";
import type { ComponentProps, JSX } from "@solidjs/web";
import { createContext, useContext } from "solid-js";

import type { RehypeCodeValuePreProps } from "../../plugins";
import { ApiReference } from "../components/ApiReference";
import { CodeBlock } from "../components/CodeBlock";
import { Demo } from "../components/Demo";
import { Heading } from "../components/Heading";
import type { HeadingLevel } from "../components/Heading";
import { ReferenceTable } from "../components/ReferenceTable";
import { TypePopover } from "../components/TypePopover";

export type Context = Record<string, ((props: never) => JSX.Element | JSX.Element[]) | undefined> & {
  [T in keyof JSX.IntrinsicElements]?: (props: ComponentProps<T>) => JSX.Element | JSX.Element[];
};

function heading(level: HeadingLevel) {
  return (props: ComponentProps<"h1">) => (
    <Heading level={level} id={props.id}>
      {props.children}
    </Heading>
  );
}

const DEFAULT_VALUE: Context = {
  h1: heading(1),
  h2: heading(2),
  h3: heading(3),
  h4: heading(4),
  p: (props) => <p class="text-fg/70 mb-4" {...props} />,
  pre: (props: ComponentProps<"pre"> & RehypeCodeValuePreProps) => (
    <CodeBlock value={props.value as string} language={props.language} title={props.title as string} />
  ),
  code: (props) => <code class="border-border rounded border px-1 py-0.25 text-sm" {...props} />,
  a: (props) => <a class="text-accent underline underline-offset-2" {...props} />,
  ul: (props) => <ul class="text-fg/70 mb-4 list-disc space-y-1 pl-5" {...props} />,
  ol: (props) => <ol class="text-fg/70 mb-4 list-decimal space-y-1 pl-5" {...props} />,
  li: (props) => <li {...props} />,
  strong: (props) => <strong class="text-fg font-semibold" {...props} />,
  em: (props) => <em {...props} />,
  blockquote: (props) => <blockquote class="border-border text-fg/60 my-4 border-l-2 pl-4" {...props} />,
  hr: (props) => <hr class="border-border my-8" {...props} />,
  Meta,
  Title,
  Demo,
  ReferenceTable,
  ApiReference,
  TypePopover,
};

const Context = createContext<Context>(DEFAULT_VALUE);

export const useMDXComponents = () => useContext(Context);
