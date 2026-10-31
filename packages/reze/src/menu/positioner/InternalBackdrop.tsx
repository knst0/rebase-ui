import type { JSX } from "reze-js";

/**
 * Backdrop rendered behind a modal menu with a cutout around the trigger.
 * @internal
 */
export function InternalBackdrop(props: {
  cutout?: Element | null | undefined;
  ref?: ((element: HTMLDivElement | null) => void) | undefined;
}): JSX.Element {
  function getClipPath(): string | undefined {
    const element = props.cutout;
    if (!element) {
      return undefined;
    }
    const rect = element.getBoundingClientRect();
    return `polygon(0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,${rect.left}px ${rect.top}px,${rect.left}px ${rect.bottom}px,${rect.right}px ${rect.bottom}px,${rect.right}px ${rect.top}px,${rect.left}px ${rect.top}px)`;
  }

  return (
    <div
      ref={props.ref}
      // Spread: the static checker does not list `role` for `div`, but the runtime renders it.
      {...{ role: "presentation" }}
      // Ensures Floating UI's outside press detection runs, as it considers
      // it an element that existed when the popup rendered.
      data-base-ui-inert=""
      style={{
        position: "fixed",
        inset: "0",
        "user-select": "none",
        "-webkit-user-select": "none",
        "clip-path": getClipPath(),
      }}
    />
  );
}
