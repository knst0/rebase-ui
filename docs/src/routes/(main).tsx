import { Tabs } from "@rebase-ui/solid/tabs";
import { For, type ParentProps, Show } from "solid-js";
import { nav } from "virtual:components-nav";
import { Icon } from "znaki/solid";

import { version } from "../../../packages/solid/package.json";

const NPM_URL = "https://www.npmjs.com/package/@rebase-ui/solid";

export default function MainLayout(props: ParentProps) {
  return (
    <div class="relative lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside class="dotted-right sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col lg:flex">
        <div class="grow overflow-y-auto pt-5 pb-4">
          <Tabs.Root>
            <Tabs.List as="nav" class="flex flex-col gap-5">
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
                            <Tabs.Tab
                              as="a"
                              nativeButton={false}
                              value={page.href}
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
              <Tabs.Indicator class="bg-fg absolute h-0.5 transition-all" />
            </Tabs.List>
          </Tabs.Root>
        </div>
        <div class="flex shrink-0 items-center px-5 pt-3 pb-4">
          <a
            href={NPM_URL}
            target="_blank"
            rel="noreferrer"
            aria-label={`@rebase-ui/solid v${version} on npm`}
            class="text-fg/40 hover:text-fg inline-flex items-center gap-1.5 rounded text-xs transition-colors"
          >
            <Icon name="tabler:brand-npm" size={16} />
            <span textContent={`v${version}`} class="tabular-nums" />
          </a>
        </div>
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
