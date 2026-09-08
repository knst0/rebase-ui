import { type Accessor, createRenderEffect, createSignal, createUniqueId } from "solid-js";

export type LabelSource = HTMLElement & { labels?: NodeListOf<HTMLLabelElement> | null | undefined };

export interface CreateAriaLabelledByParameters {
  ariaLabelledBy: Accessor<string | undefined>;
  labelId: Accessor<string | undefined>;
  labelSource: Accessor<LabelSource | null>;
  enableFallback?: Accessor<boolean | undefined> | undefined;
  labelSourceId?: Accessor<string | undefined> | undefined;
}

export function createAriaLabelledBy(params: CreateAriaLabelledByParameters): Accessor<string | undefined> {
  const [fallbackAriaLabelledBy, setFallbackAriaLabelledBy] = createSignal<string | undefined>();

  const generatedId = createUniqueId();
  const generatedLabelId = () => {
    const labelSourceId = params.labelSourceId?.();
    return labelSourceId ? `${labelSourceId}-label` : generatedId;
  };

  createRenderEffect(
    () => ({
      explicit: params.ariaLabelledBy(),
      labelId: params.labelId(),
      enableFallback: params.enableFallback?.() ?? true,
      labelSource: params.labelSource(),
      generatedLabelId: generatedLabelId(),
    }),
    ({ explicit, labelId, enableFallback, labelSource, generatedLabelId: generated }) => {
      const nextAriaLabelledBy = explicit || labelId || !enableFallback ? undefined : getAriaLabelledBy(labelSource, generated);

      setFallbackAriaLabelledBy(nextAriaLabelledBy);
    },
  );

  return () => params.ariaLabelledBy() ?? params.labelId() ?? fallbackAriaLabelledBy();
}

function getAriaLabelledBy(labelSource?: LabelSource | null, generatedLabelId?: string) {
  const label = findAssociatedLabel(labelSource);
  if (!label) {
    return undefined;
  }

  if (!label.id && generatedLabelId) {
    label.id = generatedLabelId;
  }

  return label.id || undefined;
}

function findAssociatedLabel(labelSource?: LabelSource | null) {
  if (!labelSource) {
    return undefined;
  }

  const parent = labelSource.parentElement;
  if (parent && parent.tagName === "LABEL") {
    return parent as HTMLLabelElement;
  }

  const controlId = labelSource.id;
  if (controlId) {
    const nextSibling = labelSource.nextElementSibling as HTMLLabelElement | null;
    if (nextSibling && nextSibling.htmlFor === controlId) {
      return nextSibling;
    }
  }

  const labels = labelSource.labels;
  return labels && labels[0];
}
