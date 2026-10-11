import { createUniqueId, effect, store, untrack } from "reze-js";

export type LabelSource = HTMLElement & { labels?: NodeListOf<HTMLLabelElement> | null | undefined };

export interface CreateAriaLabelledByParameters {
  ariaLabelledBy: () => string | undefined;
  labelId: () => string | undefined;
  labelSource: () => LabelSource | null;
  enableFallback?: (() => boolean | undefined) | undefined;
  labelSourceId?: (() => string | undefined) | undefined;
  ariaLabel?: (() => string | undefined) | undefined;
}

export function createAriaLabelledBy(params: CreateAriaLabelledByParameters): () => string | undefined {
  // The fallback is derived from the DOM once the label source mounts, so the write necessarily
  // happens inside the consuming component's scope.
  const fallback = store({ value: undefined as string | undefined });

  const generatedId = createUniqueId();
  const generatedLabelId = () => {
    const labelSourceId = params.labelSourceId?.();
    return labelSourceId ? `${labelSourceId}-label` : generatedId;
  };

  effect(() => {
    const explicit = params.ariaLabelledBy();
    const labelId = params.labelId();
    const enableFallback = params.enableFallback?.() ?? true;
    const labelSource = params.labelSource();
    const generated = generatedLabelId();
    const ariaLabel = params.ariaLabel?.();

    if (typeof document === "undefined") {
      return;
    }

    const hasAriaLabel = Boolean(ariaLabel?.trim());
    const nextAriaLabelledBy =
      explicit || labelId || hasAriaLabel || !enableFallback ? undefined : getAriaLabelledBy(labelSource, generated);

    // The fallback write never subscribes: the effect tracks only the inputs above.
    untrack(() => {
      if (!Object.is(fallback.value, nextAriaLabelledBy)) {
        fallback.value = nextAriaLabelledBy;
      }
    });
  });

  return () => {
    // A non-blank `aria-label` wins over any associated label, as it does on native inputs.
    const hasAriaLabel = Boolean(params.ariaLabel?.()?.trim());
    const implicitLabelId = hasAriaLabel ? undefined : params.labelId();
    return params.ariaLabelledBy() ?? implicitLabelId ?? fallback.value;
  };
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
