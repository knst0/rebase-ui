import type { JSX } from "@solidjs/web";
import { For, Show } from "solid-js";

import { cx } from "../utils/cva";

export type TableColumn<T> = {
  key: string;
  header: string;
  class?: string;
  headerClass?: string;
  cell: (row: T, index: () => number) => JSX.Element;
};

export type TableProps<T> = {
  columns: TableColumn<T>[];
  rows: T[];
  class?: string;
  rowClass?: (row: T, index: () => number) => string | undefined;
  onRowClick?: (row: T, index: () => number) => void;
  after?: (row: T, index: () => number) => JSX.Element;
};

export function Table<T>(props: TableProps<T>) {
  return (
    <Show when={props.rows.length > 0}>
      <div class={cx("squircle border-border bg-bg-code my-4 overflow-x-auto rounded-lg border shadow", props.class)}>
        <table class="w-full border-collapse text-left text-sm">
          <thead>
            <tr class="text-fg/50 text-xs">
              <For each={props.columns}>
                {(column) => <th class={cx("px-2 py-2 font-medium first:pl-7", column.headerClass)} textContent={column.header} />}
              </For>
            </tr>
          </thead>
          <tbody>
            <For each={props.rows}>
              {(row, index) => (
                <>
                  <tr
                    class={cx("border-border hover:bg-bg-code/60 border-t transition-colors", props.rowClass?.(row, index))}
                    onClick={() => props.onRowClick?.(row, index)}
                  >
                    <For each={props.columns}>{(column) => <td class={cx("align-top", column.class)}>{column.cell(row, index)}</td>}</For>
                  </tr>
                  {props.after?.(row, index)}
                </>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </Show>
  );
}
