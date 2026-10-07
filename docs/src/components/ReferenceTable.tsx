import { Show, createMemo, createSignal } from "solid-js";
import { Icon } from "znaki/solid";

import type { ReferenceRow } from "../../plugins";
import { HighlightedCode } from "./HighlightedCode";
import { Table } from "./Table";
import type { TableColumn } from "./Table";
import { TypeText } from "./TypeText";

function Description(props: { value: string }) {
  return (
    <div
      class="text-fg/70 [&_a]:text-accent [&_code]:bg-bg [&_code]:border-border max-w-prose text-sm [&_a]:underline [&_code]:rounded [&_code]:border [&_code]:px-1 [&_code]:text-xs"
      innerHTML={props.value}
    />
  );
}

function Empty() {
  return <span class="text-fg/30">—</span>;
}

export type ReferenceTableProps = {
  name?: string;
  rows?: ReferenceRow[];
  definitions?: Record<string, string>;
};

export function ReferenceTable(props: ReferenceTableProps) {
  const rows = () => props.rows ?? [];
  const [expanded, setExpanded] = createSignal<ReadonlySet<ReferenceRow>>(new Set());

  const hasType = createMemo(() => rows().some((row) => row.type !== undefined));
  const hasDefault = createMemo(() => rows().some((row) => row.default !== undefined));
  const hasDescription = createMemo(() => !hasType() && rows().some((row) => row.description.trim() !== ""));

  const isExpandable = (row: ReferenceRow) => !hasDescription() && row.description.trim() !== "";

  const toggle = (row: ReferenceRow) => {
    if (!isExpandable(row)) return;
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(row)) next.add(row);
      return next;
    });
  };

  const columns = createMemo(() => {
    const list: TableColumn<ReferenceRow>[] = [
      {
        key: "name",
        header: "Name",
        class: "py-2 pr-3 pl-2",
        cell: (row) => (
          <span class="flex items-start gap-1.5">
            <Show when={isExpandable(row)} fallback={<span class="w-4 shrink-0" />}>
              <span class={["text-fg/40 mt-0.5 w-4 shrink-0 transition-transform", { "rotate-90": expanded().has(row) }]}>
                <Icon name="tabler:chevron-right" size={14} />
              </span>
            </Show>
            <code class="text-fg text-xs font-medium" textContent={row.name} />
          </span>
        ),
      },
    ];

    if (hasType()) {
      list.push({
        key: "type",
        header: "Type",
        class: "py-2 pr-3",
        cell: (row) => (
          <Show when={row.type} fallback={<Empty />}>
            {(type) => <TypeText value={type()} definitions={props.definitions} />}
          </Show>
        ),
      });
    }

    if (hasDefault()) {
      list.push({
        key: "default",
        header: "Default",
        class: "py-2 pr-2",
        cell: (row) => (
          <Show when={row.default} fallback={<Empty />}>
            {(value) => <HighlightedCode value={value()} />}
          </Show>
        ),
      });
    }

    if (hasDescription()) {
      list.push({
        key: "description",
        header: "Description",
        class: "py-2 pr-2",
        cell: (row) => <Description value={row.description} />,
      });
    }

    return list;
  });

  return (
    <Table
      rows={rows()}
      columns={columns()}
      onRowClick={toggle}
      rowClass={(row) => (isExpandable(row) ? "cursor-pointer" : undefined)}
      after={(row) => (
        <Show when={expanded().has(row) && isExpandable(row)}>
          <tr class="bg-bg-code/40">
            <td colspan={columns().length} class="px-2 pt-1 pb-3 pl-8">
              <Description value={row.description} />
            </td>
          </tr>
        </Show>
      )}
    />
  );
}
