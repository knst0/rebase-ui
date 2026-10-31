import type { ValidComponent } from "@solidjs/web";

import { MenuPositioner } from "../../menu/positioner/MenuPositioner";

/**
 * Positions the context menu popup against the cursor.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Context Menu](https://rebase-ui.knst.dev/components/context-menu)
 */
export const ContextMenuPositioner = MenuPositioner;

export type ContextMenuPositionerState = MenuPositioner.State;
export type ContextMenuPositionerProps<T extends ValidComponent = "div"> = MenuPositioner.Props<T>;

export namespace ContextMenuPositioner {
  export type State = ContextMenuPositionerState;
  export type Props<T extends ValidComponent = "div"> = ContextMenuPositionerProps<T>;
}
