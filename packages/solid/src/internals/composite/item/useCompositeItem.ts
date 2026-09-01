import { onCleanup } from "solid-js";

import { isElementDisabled } from "../composite";
import { type CompositeItemMetadata, useCompositeRootContext } from "../root/CompositeRootContext";

export interface UseCompositeItemParameters {
  metadata?: CompositeItemMetadata | (() => CompositeItemMetadata) | undefined;
}

export interface UseCompositeItemReturnValue {
  getCompositeProps: (externalProps?: Record<string, any>) => Record<string, any>;
  compositeRef: (element: HTMLElement | null) => void;
  index: () => number;
}

export function useCompositeItem(parameters: UseCompositeItemParameters = {}): UseCompositeItemReturnValue | undefined {
  const context = useCompositeRootContext();

  if (!context) {
    return undefined;
  }

  let itemElement: HTMLElement | null = null;

  const index = () => (itemElement === null ? -1 : context.elements().indexOf(itemElement));

  const compositeRef = (element: HTMLElement | null) => {
    itemElement = element;
    if (element !== null) {
      const metadata = typeof parameters.metadata === "function" ? parameters.metadata() : parameters.metadata;
      context.registerItem(element, metadata);
    }
  };

  onCleanup(() => {
    if (itemElement !== null) {
      context.unregisterItem(itemElement);
    }
  });

  const getCompositeProps = (externalProps: Record<string, any> = {}): Record<string, any> => {
    const props: Record<string, any> = {};

    for (const key in externalProps) {
      if (key === "onFocus" || key === "onMouseMove" || key === "tabIndex") {
        continue;
      }
      Object.defineProperty(props, key, { enumerable: true, configurable: true, get: () => externalProps[key] });
    }

    Object.defineProperty(props, "tabIndex", {
      enumerable: true,
      configurable: true,
      get: () => {
        const currentIndex = index();
        if (currentIndex === -1) {
          return externalProps.tabIndex;
        }
        return currentIndex === context.highlightedIndex() ? 0 : -1;
      },
    });

    props.onFocus = (event: FocusEvent) => {
      externalProps.onFocus?.(event);

      const currentIndex = index();
      if (currentIndex !== -1) {
        context.setHighlightedIndex(currentIndex);
      }
    };

    props.onMouseMove = (event: MouseEvent) => {
      externalProps.onMouseMove?.(event);

      if (!context.highlightItemOnHover() || itemElement === null) {
        return;
      }

      if (index() !== context.highlightedIndex() && !isElementDisabled(itemElement)) {
        itemElement.focus();
      }
    };

    return props;
  };

  return { getCompositeProps, compositeRef, index };
}
