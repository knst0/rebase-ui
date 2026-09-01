import { useLocation } from "@solidjs/router";
import { For, type ParentProps, Show, createMemo } from "solid-js";
import { nav, type NavHeading, type NavItem } from "virtual:components-nav";
import { Icon } from "znaki/solid";

function flatten(items: NavItem[]): NavItem[] {
  return items.flatMap((item) => (item.children ? [item, ...flatten(item.children)] : [item]));
}

function HeadingList(props: { headings: NavHeading[]; depth: number }) {
  return (
    <ul class={{ "space-y-1": props.depth === 0, "pl-3": props.depth > 0 }}>
      <For each={props.headings}>
        {(heading) => (
          <li>
            <a href={`#${heading.id}`} textContent={heading.title} class="text-fg/60 hover:text-fg block truncate py-1 text-sm" />
            <Show when={heading.children.length > 0}>
              <HeadingList headings={heading.children} depth={props.depth + 1} />
            </Show>
          </li>
        )}
      </For>
    </ul>
  );
}

export default function ComponentsLayout(props: ParentProps) {
  const location = useLocation();
  const headings = createMemo(() => {
    const path = location.pathname.replace(/\/$/, "");
    return flatten(nav).find((item) => item.path === path)?.headings ?? [];
  });

  return (
    <>
      <main class="mx-auto mt-12 w-full max-w-[680px] py-20 sm:py-28 lg:mt-0">{props.children}</main>
      <aside class="sticky top-0 pt-5 pb-4">
        <Show when={headings().length > 0}>
          <nav>
            <span class="text-fg/40 mb-2 inline-flex items-center gap-2 text-xs">
              <Icon name="tabler:align-left" size={16} />
              <span textContent="On this page" />
            </span>
            <HeadingList headings={headings()} depth={0} />
          </nav>
        </Show>
      </aside>
    </>
  );
}
