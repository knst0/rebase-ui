import type { Accessor, Setter } from "solid-js";

import { createRegisteredLabelId } from "./createRegisteredLabelId";
import { useLabelableContext } from "./LabelableContext";

export interface CreateLabelParameters {
  id?: Accessor<string | undefined> | undefined;
  fallbackControlId?: Accessor<string | null | undefined> | undefined;
  native?: boolean | undefined;
  setLabelId?: Setter<string | undefined> | undefined;
  focusControl?: ((event: MouseEvent, controlId: string | null | undefined) => void) | undefined;
}

export function createLabel(params: CreateLabelParameters = {}): Record<string, any> {
  const native = params.native ?? false;

  const { controlId: contextControlId, setLabelId: setContextLabelId } = useLabelableContext();

  const syncLabelId = ((nextLabelId: string | undefined) => {
    setContextLabelId(nextLabelId);
    params.setLabelId?.(nextLabelId);
  }) as Setter<string | undefined>;

  const id = createRegisteredLabelId(() => params.id?.(), syncLabelId);

  const resolvedControlId = () => contextControlId() ?? params.fallbackControlId?.();

  function focusControl(event: MouseEvent) {
    if (params.focusControl) {
      params.focusControl(event, resolvedControlId());
      return;
    }

    const controlId = resolvedControlId();
    if (!controlId) {
      return;
    }

    const currentTarget = event.currentTarget as HTMLElement;
    const controlElement = (currentTarget.ownerDocument ?? document).getElementById(controlId);
    if (isHTMLElement(controlElement)) {
      focusElementWithVisible(controlElement);
    }
  }

  function handleInteraction(event: MouseEvent) {
    const target = getTarget(event) as HTMLElement | null;
    if (target?.closest("button,input,select,textarea")) {
      return;
    }

    if (!event.defaultPrevented && event.detail > 1) {
      event.preventDefault();
    }

    if (native) {
      return;
    }

    focusControl(event);
  }

  const props: Record<string, any> = {};

  Object.defineProperty(props, "id", { enumerable: true, configurable: true, get: id });

  if (native) {
    Object.defineProperty(props, "for", {
      enumerable: true,
      configurable: true,
      get: () => resolvedControlId() ?? undefined,
    });
    props.onMouseDown = handleInteraction;
    return props;
  }

  props.onClick = handleInteraction;
  props.onPointerDown = (event: PointerEvent) => {
    event.preventDefault();
  };

  return props;
}

export function focusElementWithVisible(element: HTMLElement) {
  element.focus({ focusVisible: true } as FocusOptions);
}

function isHTMLElement(element: unknown): element is HTMLElement {
  return element != null && typeof element === "object" && "tagName" in element && "style" in element;
}

function getTarget(event: Event): EventTarget | null {
  return event.composedPath?.()[0] ?? event.target;
}
