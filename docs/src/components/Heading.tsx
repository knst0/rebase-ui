import type { ComponentProps, JSX } from "@solidjs/web";
import { Dynamic } from "@solidjs/web";

import { cx } from "../utils/cva";

export type HeadingLevel = 1 | 2 | 3 | 4;

const STYLES: Record<HeadingLevel, string> = {
  1: "mb-4 text-3xl font-semibold",
  2: "mt-12 mb-4 block text-xl font-semibold",
  3: "mt-12 mb-3 block font-semibold",
  4: "mt-8 mb-2 block font-semibold",
};

export type HeadingProps = {
  level: HeadingLevel;
  id?: ComponentProps<"h1">["id"];
  class?: string;
  children?: JSX.Element;
};

export function Heading(props: HeadingProps) {
  return (
    <Dynamic
      component={`h${props.level}` as const}
      id={props.id}
      class={cx(STYLES[props.level], props.class)}
      style="scroll-margin-top: 32px;"
    >
      <a href={`#${props.id}`}>{props.children}</a>
    </Dynamic>
  );
}
