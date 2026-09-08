import { CodeTooltip } from "./Tooltip";

export function TypePopover(props: { label: string; source: string }) {
  return (
    <CodeTooltip source={props.source} placement="bottom" panelClass="bg-bg-code max-w-[min(32rem,80vw)]">
      {(state) => (
        <button
          type="button"
          class="text-accent cursor-help underline decoration-dotted underline-offset-4"
          aria-expanded={state.open() ? "true" : "false"}
          aria-describedby={state.describedBy()}
          onMouseEnter={state.show}
          onMouseLeave={state.hide}
          onFocus={state.show}
          onBlur={state.hide}
          onClick={state.toggle}
          textContent={props.label}
        />
      )}
    </CodeTooltip>
  );
}
