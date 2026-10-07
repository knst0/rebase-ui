import type { JSX } from "@solidjs/web";

const base = {
  "clip-path": "inset(50%)",
  overflow: "hidden",
  "white-space": "nowrap",
  border: "0",
  padding: "0",
  width: "1px",
  height: "1px",
  margin: "-1px",
} satisfies JSX.CSSProperties;

export const visuallyHidden = Object.freeze({
  ...base,
  position: "fixed",
  top: "0",
  left: "0",
} satisfies JSX.CSSProperties);

export const visuallyHiddenInput = Object.freeze({ ...base, position: "absolute" } satisfies JSX.CSSProperties);
