import { For, type ParentProps, Show } from "solid-js";
import { nav } from "virtual:components-nav";

export default function MainLayout(props: ParentProps) {
  return (
    <div class="relative grid grid-cols-[260px_1fr_224px]">
      <aside class="sticky top-0 flex h-screen flex-col overflow-y-auto pt-5 pb-4">
        <nav class="flex flex-col gap-5">
          <For each={GROUPS}>
            {(group) => (
              <figure class="px-5">
                <Show when={!group.hideLabel}>
                  <figcaption textContent={group.label} class="text-fg/40 mb-2 inline-block text-xs" />
                </Show>
                <ul class="space-y-1">
                  <For each={group.pages}>
                    {(page) => (
                      <li>
                        <a
                          href={page.href}
                          textContent={page.name}
                          class="text-fg/70 hover:bg-fg/5 data-active:bg-fg/10 data-active:text-fg -ml-2 flex h-7 items-center rounded px-2 text-sm"
                        />
                      </li>
                    )}
                  </For>
                </ul>
              </figure>
            )}
          </For>
        </nav>
      </aside>
      {props.children}
    </div>
  );
}

const GROUPS = [
  {
    id: "main",
    label: "Main",
    hideLabel: true,
    pages: [{ name: "Showcase", href: "/" }],
  },
  {
    id: "components",
    label: "Components",
    pages: nav.map((item) => ({ name: item.title, href: item.path })),
  },
];
