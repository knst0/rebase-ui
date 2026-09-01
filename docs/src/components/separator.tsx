import { Separator as SeparatorPrimitive } from "@rebase-ui/solid/separator";
import type { ValidComponent } from "@solidjs/web";
import { omit } from "solid-js";

import { cx } from "./cva";

export function Separator<T extends ValidComponent = "div">(props: SeparatorProps<T>) {
  const rest = omit(props as SeparatorPrimitive.Props, "class");
  return <SeparatorPrimitive class={cx("r-separator", props.class as string | undefined)} {...rest} />;
}

export type SeparatorProps<T extends ValidComponent = "div"> = SeparatorPrimitive.Props<T>;
