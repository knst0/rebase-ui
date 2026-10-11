interface ResolveRenderedIdProps {
  id?: string | undefined;
}

/**
 * Resolves an element's id using the same precedence as `RenderElement`.
 * Returns `''` when the element renders with an explicitly empty id, which consumers must treat
 * as "no id" rather than falling back to the generated one, so ARIA relationships never reference
 * an id no element carries.
 *
 * @internal
 */
export function resolveRenderedId(props: ResolveRenderedIdProps, fallbackId: string | undefined) {
  return props.id ?? fallbackId;
}

/**
 * Resolves the element's id and returns a ref that publishes it to the owner while mounted.
 * A generated fallback is never published as an override, so removing an explicit id lets the
 * element return to the generated one.
 *
 * @internal
 */
export function createRenderedId(
  props: ResolveRenderedIdProps,
  defaultId: string | undefined,
  setId: ((id: string | undefined) => void) | undefined,
) {
  const id = resolveRenderedId(props, defaultId);
  const registeredId = id === defaultId ? undefined : id;

  const ref = (element: HTMLElement | null) => setId?.(element ? registeredId : undefined);

  return [id, ref] as const;
}
