import type { JSX } from "reze-js";

export function PrehydrationScript(props: PrehydrationScriptProps): JSX.Element {
  if (typeof document !== "undefined") {
    return null;
  }

  return <script>{props.script}</script>;
}

export interface PrehydrationScriptProps {
  script: string;
}
