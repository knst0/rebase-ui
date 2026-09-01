import { onCleanup } from "solid-js";

import { overrideProps } from "../../overrideProps";
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

  const initialTabIndex = context.claimInitialTabIndex();

  const index = () => context.indexOf(itemElement);

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

  const getCompositeProps = (externalProps: Record<string, any> = {}): Record<string, any> =>
    overrideProps(externalProps, {
      tabIndex: initialTabIndex,

      onFocus(event: FocusEvent) {
        externalProps.onFocus?.(event);

        const currentIndex = index();
        if (currentIndex !== -1) {
          context.setHighlightedIndex(currentIndex);
        }
      },

      onMouseMove(event: MouseEvent) {
        externalProps.onMouseMove?.(event);

        if (!context.highlightItemOnHover() || itemElement === null) {
          return;
        }

        if (index() !== context.highlightedIndex() && !isElementDisabled(itemElement)) {
          itemElement.focus();
        }
      },
    });

  return { getCompositeProps, compositeRef, index };
}
