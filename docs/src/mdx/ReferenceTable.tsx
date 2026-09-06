import { For, Show, createMemo, createSignal } from "solid-js";
import { highlight } from "sugar-high";
import { lang } from "sugar-high/lang";
import { Icon } from "znaki/solid";

import type { ReferenceRow } from "../../plugins";
import { TypeText } from "./TypeText";

function Description(props: { value: string }) {
  return (
    <div
      class="text-fg/70 [&_a]:text-accent [&_code]:bg-bg [&_code]:border-border max-w-prose text-sm [&_a]:underline [&_code]:rounded [&_code]:border [&_code]:px-1 [&_code]:text-xs"
      innerHTML={props.value}
    />
  );
}

function Code(props: { value: string }) {
  return <code class="text-xs whitespace-pre-wrap" innerHTML={highlight(props.value, { lang: lang("typescript") })} />;
}

function Row(props: { row: ReferenceRow; columns: Columns; definitions?: Record<string, string> }) {
  const [open, setOpen] = createSignal(false);
  const hasDetails = () => !props.columns.description && props.row.description.trim() !== "";

  return (
    <>
      <tr
        class={["border-border hover:bg-bg-code/60 border-t transition-colors", { "cursor-pointer": hasDetails() }]}
        onClick={() => hasDetails() && setOpen(!open())}
      >
        <td class="py-2 pr-3 pl-2 align-top">
          <span class="flex items-start gap-1.5">
            <Show when={hasDetails()} fallback={<span class="w-4 shrink-0" />}>
              <span class={["text-fg/40 mt-0.5 w-4 shrink-0 transition-transform", { "rotate-90": open() }]}>
                <Icon name="tabler:chevron-right" size={14} />
              </span>
            </Show>
            <code class="text-fg text-xs font-medium" textContent={props.row.name} />
          </span>
        </td>
        <Show when={props.columns.type}>
          <td class="py-2 pr-3 align-top">
            <Show when={props.row.type} fallback={<span class="text-fg/30">—</span>}>
              {(type) => <TypeText value={type()} definitions={props.definitions} />}
            </Show>
          </td>
        </Show>
        <Show when={props.columns.default}>
          <td class="py-2 pr-2 align-top">
            <Show when={props.row.default} fallback={<span class="text-fg/30">—</span>}>
              {(value) => <Code value={value()} />}
            </Show>
          </td>
        </Show>
        <Show when={props.columns.description}>
          <td class="py-2 pr-2 align-top">
            <Description value={props.row.description} />
          </td>
        </Show>
      </tr>
      <Show when={open() && hasDetails()}>
        <tr class="bg-bg-code/40">
          <td colspan={props.columns.headers.length} class="px-2 pt-1 pb-3 pl-8">
            <Description value={props.row.description} />
          </td>
        </tr>
      </Show>
    </>
  );
}

type Columns = { headers: string[]; type: boolean; default: boolean; description: boolean };

function columnsOf(rows: ReferenceRow[]): Columns {
  const type = rows.some((row) => row.type !== undefined);
  const hasDefault = rows.some((row) => row.default !== undefined);
  const description = !type && rows.some((row) => row.description.trim() !== "");

  return {
    headers: ["Name", ...(type ? ["Type"] : []), ...(hasDefault ? ["Default"] : []), ...(description ? ["Description"] : [])],
    type,
    default: hasDefault,
    description,
  };
}

export function ReferenceTable(props: { name?: string; rows?: ReferenceRow[]; definitions?: Record<string, string> }) {
  const rows = () => props.rows ?? [];
  const columns = createMemo(() => columnsOf(rows()));

  return (
    <Show when={rows().length > 0}>
      <div class="squircle border-border bg-bg-code my-4 overflow-x-auto rounded-lg border shadow">
        <table class="w-full border-collapse text-left text-sm">
          <thead>
            <tr class="text-fg/50 text-xs">
              <For each={columns().headers}>{(header) => <th class="px-2 py-2 font-medium first:pl-7" textContent={header} />}</For>
            </tr>
          </thead>
          <tbody>
            <For each={rows()}>{(row) => <Row row={row} columns={columns()} definitions={props.definitions} />}</For>
          </tbody>
        </table>
      </div>
    </Show>
  );
}
