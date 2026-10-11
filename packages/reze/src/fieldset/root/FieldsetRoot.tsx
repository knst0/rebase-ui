import { dynamicElement, getOwner, omitProps, runWithOwner, store, untrack, type JSX } from "reze-js";

import { resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ChildrenValue, RebaseUIComponentProps } from "../../internals/types";
import { FieldsetRootContext, useFieldsetRootContext } from "./FieldsetRootContext";

/**
 * Groups the fieldset legend and the associated fields.
 * Renders a `<fieldset>` element.
 *
 * Documentation: [Rebase UI Fieldset](https://rebase-ui.knst.dev/components/fieldset)
 */
export function FieldsetRoot<T extends JSX.ElementType = "fieldset">(props: FieldsetRoot.Props<T>) {
  const rest = omitProps(props, "as", "disabled", "class", "style", "children", "ref");

  const state = store({ legendId: undefined as string | undefined });

  const parent = useFieldsetRootContext(true);

  function disabled(): boolean {
    return parent?.disabled() === true || props.disabled === true;
  }

  function legendId(): string | undefined {
    return state.legendId;
  }

  function setLegendId(next: string | undefined | ((prev: string | undefined) => string | undefined)): void {
    // Actions never subscribe: read the previous id untracked so a call from a
    // reactive scope does not subscribe the caller to the id it writes.
    state.legendId =
      typeof next === "function" ? untrack(() => (next as (prev: string | undefined) => string | undefined)(state.legendId)) : next;
  }

  const contextValue: FieldsetRootContext = { legendId, setLegendId, disabled };

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "fieldset");

  // The provider lives inside the tag: context does not flow through dynamicElement,
  // so providing above it would leave the fieldset parts without context. Children
  // resolve in FieldsetRootContent below so they are created inside the provider.
  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      aria-labelledby={legendId()}
      bool:disabled={disabled()}
      data-disabled={disabled() ? "" : undefined}
      class={resolveClassValue(props.class, { disabled: disabled() })}
      style={resolveStyleValue(props.style, { disabled: disabled() })}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      <FieldsetRootContext value={contextValue}>
        <FieldsetRootContent>{props.children}</FieldsetRootContent>
      </FieldsetRootContext>
    </Tag>
  );
}

/**
 * Resolves the root children inside the fieldset context. Render-prop children are
 * invoked inside a thunk (bound by the renderer) and re-invoked with a fresh state
 * snapshot whenever the disabled state changes, matching the Solid layer where the
 * children memo re-resolves on state change.
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives return
 * thunks, and invoking one here would resolve the subtree one-shot instead of binding it.
 */
export function FieldsetRootContent(props: { children: ChildrenValue<FieldsetRootState> }) {
  const children = props.children;

  const { disabled } = useFieldsetRootContext();

  if (typeof children === "function" && children.length >= 1) {
    const render = children as (state: FieldsetRootState) => JSX.Element;
    // The thunk runs later under the renderer's owner, so re-enter this owner
    // to keep the fieldset context (and disposal) visible to the rendered parts.
    const owner = getOwner();

    return () => {
      // Subscribe the binding: the render below runs untracked under the owner.
      const snapshot: FieldsetRootState = { disabled: disabled() };

      return runWithOwner(owner, () => render(snapshot));
    };
  }

  return children as JSX.Element;
}

export interface FieldsetRootState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface FieldsetRootOwnProps {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export type FieldsetRootProps<T extends JSX.ElementType = "fieldset"> = FieldsetRootOwnProps & RebaseUIComponentProps<T, FieldsetRootState>;

export namespace FieldsetRoot {
  export type State = FieldsetRootState;
  export type Props<T extends JSX.ElementType = "fieldset"> = FieldsetRootProps<T>;
  export type OwnProps = FieldsetRootOwnProps;
}
