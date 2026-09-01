import { isServer, type JSX, NoHydration } from "@solidjs/web";

export function PrehydrationScript(props: PrehydrationScriptProps): JSX.Element {
  if (!isServer) {
    return null;
  }

  return (
    <NoHydration>
      <script innerHTML={props.script} />
    </NoHydration>
  );
}

export interface PrehydrationScriptProps {
  script: string;
}
