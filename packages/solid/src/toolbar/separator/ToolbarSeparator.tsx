import type { ValidComponent } from "@solidjs/web";
import { merge } from "solid-js";

import type { Orientation } from "../../internals/types";
import { Separator } from "../../separator";
import { useToolbarRootContext } from "../root/ToolbarRootContext";

const OPPOSITE_ORIENTATION: Record<Orientation, Orientation> = {
  horizontal: "vertical",
  vertical: "horizontal",
};

/**
 * A separator element accessible to screen readers.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Toolbar](https://rebase-ui.knst.dev/components/toolbar)
 */
export function ToolbarSeparator<T extends ValidComponent = "div">(props: ToolbarSeparator.Props<T>) {
  const { orientation } = useToolbarRootContext();

  const merged = merge(
    {
      get orientation() {
        return OPPOSITE_ORIENTATION[orientation()];
      },
    },
    props,
  );

  return <Separator {...(merged as Separator.Props)} />;
}

export type ToolbarSeparatorState = Separator.State;

export type ToolbarSeparatorProps<T extends ValidComponent = "div"> = Separator.Props<T>;

export namespace ToolbarSeparator {
  export type State = ToolbarSeparatorState;
  export type Props<T extends ValidComponent = "div"> = ToolbarSeparatorProps<T>;
}
