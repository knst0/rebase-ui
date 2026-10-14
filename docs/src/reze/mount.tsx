/** @jsxImportSource reze-js */
import { render, type JSX } from "reze-js";

/** Renders a Reze component into `element` from the Solid docs shell; returns the disposer. Compiled by the Reze compiler. */
export function mountReze(Component: () => JSX.Element, element: Element): () => void {
  return render(() => <Component />, element);
}
