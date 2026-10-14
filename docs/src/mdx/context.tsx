import { Meta, Title } from "@solidjs/meta";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, createContext, omit, useContext, type ParentProps } from "solid-js";

import type { RehypeCodeValuePreProps } from "../../plugins";
import { localize } from "../../plugins/shared/frameworks";
import { ApiReference } from "../components/ApiReference";
import { CodeBlock } from "../components/CodeBlock";
import { Demo } from "../components/Demo";
import { Heading } from "../components/Heading";
import type { HeadingLevel } from "../components/Heading";
import { ReferenceTable } from "../components/ReferenceTable";
import { TypePopover } from "../components/TypePopover";
import { frameworkHref, useFramework, type FrameworkId } from "../framework";

/** `<Framework only="reze">`: content for one framework; the docs are otherwise shared. */
function Framework(props: ParentProps<{ only: FrameworkId }>) {
  const framework = useFramework();
  return <Show when={framework().id === props.only}>{props.children}</Show>;
}

/** Root-relative links point into the current framework's docs. */
function Link(props: ComponentProps<"a">) {
  const framework = useFramework();
  const rest = omit(props, "href");
  return (
    <a
      class="text-accent underline underline-offset-2"
      href={typeof props.href === "string" && /^\/(?!\/)/.test(props.href) ? frameworkHref(framework().id, props.href) : props.href}
      {...rest}
    />
  );
}

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
  pre: (props: ComponentProps<"pre"> & RehypeCodeValuePreProps) => {
    const framework = useFramework();
    return <CodeBlock value={localize(props.value as string, framework().id)} language={props.language} title={props.title as string} />;
  },
  code: (props) => <code class="border-border rounded border px-1 py-0.25 text-sm" {...props} />,
  a: Link,
  ul: (props) => <ul class="text-fg/70 mb-4 list-disc space-y-1 pl-5" {...props} />,
  ol: (props) => <ol class="text-fg/70 mb-4 list-decimal space-y-1 pl-5" {...props} />,
  li: (props) => <li {...props} />,
  strong: (props) => <strong class="text-fg font-semibold" {...props} />,
  em: (props) => <em {...props} />,
  blockquote: (props) => <blockquote class="border-border text-fg/60 my-4 border-l-2 pl-4" {...props} />,
  hr: (props) => <hr class="border-border my-8" {...props} />,
  Meta: (props: ComponentProps<typeof Meta>) => {
    const framework = useFramework();
    const rest = omit(props, "content");
    return <Meta content={typeof props.content === "string" ? localize(props.content, framework().id) : props.content} {...rest} />;
  },
  Title,
  Demo,
  Framework,
  ReferenceTable,
  ApiReference,
  TypePopover,
};

const Context = createContext<Context>(DEFAULT_VALUE);

export const useMDXComponents = () => useContext(Context);
