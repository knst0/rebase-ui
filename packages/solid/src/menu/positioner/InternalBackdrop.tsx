/**
 * Backdrop rendered behind a modal menu with a cutout around the trigger.
 * @internal
 */
export function InternalBackdrop(props: { cutout?: Element | null | undefined }) {
  const cutout = () => props.cutout;

  function getClipPath(): string | undefined {
    const element = cutout();
    if (!element) {
      return undefined;
    }
    const rect = element.getBoundingClientRect();
    return `polygon(0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,${rect.left}px ${rect.top}px,${rect.left}px ${rect.bottom}px,${rect.right}px ${rect.bottom}px,${rect.right}px ${rect.top}px,${rect.left}px ${rect.top}px)`;
  }

  return (
    <div
      role="presentation"
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
