import { error } from "./error";

const INTERACTIVE_SELECTOR = 'button, a[href], [role="button"]';

function describeElement(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const role = element.getAttribute("role");
  return role === "button" && tag !== "button" ? `<${tag} role="button">` : `<${tag}>`;
}

/**
 * Dev-only check for parts that render a button or link (triggers, buttons). Nesting one
 * interactive element inside another is invalid HTML and breaks keyboard and screen reader
 * behavior. Solid, unlike React DOM, doesn't validate DOM nesting, so `<Tooltip.Trigger><Button /></Tooltip.Trigger>`
 * silently renders `<button><button>`.
 *
 * Call once the element is mounted and attached to its parent.
 */
export function warnNestedInteractive(element: Element | null | undefined) {
  if (process.env.NODE_ENV === "production" || !element) {
    return;
  }

  const descendant = element.querySelector(INTERACTIVE_SELECTOR);
  const ancestor = descendant ? null : (element.parentElement?.closest(INTERACTIVE_SELECTOR) ?? null);

  if (!descendant && !ancestor) {
    return;
  }

  const outer = descendant ? element : ancestor!;
  const inner = descendant ?? element;

  error(
    `${describeElement(inner)} is nested inside ${describeElement(outer)}. Interactive elements must not contain other interactive ` +
      "elements: the markup is invalid and breaks keyboard and screen reader behavior. To compose a component with " +
      "a part that already renders a button or link, pass it through the `as` prop " +
      "(for example `<Tooltip.Trigger as={Button}>`) instead of nesting it as a child.",
  );
}
