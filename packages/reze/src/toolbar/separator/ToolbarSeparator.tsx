import { omitProps, type JSX } from "reze-js";

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
export function ToolbarSeparator<T extends JSX.ElementType = "div">(props: ToolbarSeparator.Props<T>) {
  const rest = omitProps(props, "orientation");

  const toolbar = useToolbarRootContext();

  function orientation(): Orientation {
    return props.orientation ?? OPPOSITE_ORIENTATION[toolbar.orientation()];
  }

  return <Separator {...(rest as Separator.Props)} orientation={orientation()} data-orientation={orientation()} />;
}

export type ToolbarSeparatorState = Separator.State;

export type ToolbarSeparatorProps<T extends JSX.ElementType = "div"> = Separator.Props<T>;

export namespace ToolbarSeparator {
  export type State = ToolbarSeparatorState;
  export type Props<T extends JSX.ElementType = "div"> = ToolbarSeparatorProps<T>;
}
