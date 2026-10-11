import { dynamicElement, omitProps, type JSX } from "reze-js";

import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { LIST_FUNCTIONAL_STYLES } from "../popup/utils";
import { useSelectPositionerContext } from "../positioner/SelectPositionerContext";
import { useSelectRootContext } from "../root/SelectRootContext";

/**
 * A container for the select items.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectList<T extends JSX.ElementType = "div">(props: SelectList.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const store = useSelectRootContext();
  const positioner = useSelectPositionerContext();

  function ref(element: HTMLDivElement | null): void {
    store.set("listElement", element);
    (props.ref as ((element: HTMLDivElement | null) => void) | undefined)?.(element);
  }

  function listStyle(): string | JSX.CSSProperties | undefined {
    // Mirrors upstream `LIST_FUNCTIONAL_STYLES`, applied while the positioner aligns the
    // selected item with the trigger. Keys are kebab-case so the browser applies them.
    const internal = positioner.alignItemWithTriggerActive() ? ({ ...LIST_FUNCTIONAL_STYLES } as Record<string, string | undefined>) : {};
    return mergeStyleValue(internal, resolveStyleValue(props.style, {}));
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a sibling mounts
  // or unmounts. The default path renders a static `<div>`; only a customized `as` keeps the
  // dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        id={`${store.select("id") as string}-list`}
        role="listbox"
        aria-multiselectable={(store.select("multiple") as boolean) ? "true" : undefined}
        aria-readonly={(store.select("readOnly") as boolean) ? "true" : undefined}
        onScroll={(event: Event) => {
          store.context.scrollHandlerRef.current?.(event.currentTarget as HTMLDivElement);
        }}
        class={resolveClassValue(props.class, {})}
        style={listStyle()}
        ref={ref}
      >
        {resolveChildrenValue(children, () => ({}))}
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      id={`${store.select("id") as string}-list`}
      role="listbox"
      aria-multiselectable={(store.select("multiple") as boolean) ? "true" : undefined}
      aria-readonly={(store.select("readOnly") as boolean) ? "true" : undefined}
      onScroll={(event: Event) => {
        store.context.scrollHandlerRef.current?.(event.currentTarget as HTMLDivElement);
      }}
      class={resolveClassValue(props.class, {})}
      style={listStyle()}
      ref={ref}
    >
      {resolveChildrenValue(children, () => ({}))}
    </Tag>
  );
}

export interface SelectListState {}

export type SelectListProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, SelectListState>;

export namespace SelectList {
  export type State = SelectListState;
  export type Props<T extends JSX.ElementType = "div"> = SelectListProps<T>;
}
