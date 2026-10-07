import { Drawer } from "@rebase-ui/solid/drawer";
import { Tabs } from "@rebase-ui/solid/tabs";
import { useBeforeLeave, useLocation } from "@solidjs/router";
import { For, type ParentProps, Show, createMemo, createSignal } from "solid-js";
import { nav } from "virtual:components-nav";
import { Icon } from "znaki/solid";

import { version } from "../../../packages/solid/package.json";

const NPM_URL = "https://www.npmjs.com/package/@rebase-ui/solid";

export default function MainLayout(props: ParentProps) {
  const location = useLocation();
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [open, setOpen] = createSignal(false);
  const path = createMemo(() => location.pathname.replace(/\/$/, "").slice(base.length) || "/");

  useBeforeLeave(() => {
    setOpen(false);
  });

  return (
    <>
      <header class="bg-bg border-border sticky top-0 z-40 flex h-14 items-center justify-between border-b px-4 lg:hidden">
        <a href="/" class="text-sm font-semibold tracking-tight">
          Rebase UI
        </a>
        <Drawer.Root open={open()} onOpenChange={setOpen} swipeDirection="right">
          <Drawer.Trigger
            aria-label="Open navigation"
            class="text-fg/70 hover:bg-fg/5 hover:text-fg inline-flex h-9 w-9 items-center justify-center rounded transition-colors"
          >
            <Icon name="tabler:menu-2" size={20} />
          </Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Backdrop class="fixed inset-0 min-h-dvh bg-black opacity-[calc(var(--backdrop-opacity)*(1-var(--drawer-swipe-progress)))] transition-opacity duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] [--backdrop-opacity:0.2] data-ending-style:opacity-0 data-starting-style:opacity-0 data-swiping:duration-0 dark:[--backdrop-opacity:0.7]" />
            <Drawer.Viewport class="fixed inset-0 flex items-stretch justify-end">
              <Drawer.Popup class="bg-bg border-border text-fg h-full w-[280px] max-w-[calc(100vw-3rem)] [transform:translateX(var(--drawer-swipe-movement-x))] overflow-y-auto overscroll-contain border-l transition-transform duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] outline-none data-ending-style:[transform:translateX(calc(100%+2px))] data-starting-style:[transform:translateX(calc(100%+2px))] data-swiping:select-none">
                <Drawer.Content class="flex min-h-full flex-col px-4 pt-4 pb-4">
                  <div class="mb-2 flex items-center justify-between">
                    <Drawer.Title class="text-sm font-semibold">Navigation</Drawer.Title>
                    <Drawer.Close
                      aria-label="Close navigation"
                      class="text-fg/70 hover:bg-fg/5 hover:text-fg inline-flex h-9 w-9 items-center justify-center rounded transition-colors"
                    >
                      <Icon name="tabler:x" size={20} />
                    </Drawer.Close>
                  </div>
                  <nav class="flex grow flex-col gap-5 overflow-y-auto py-2">
                    <For each={GROUPS}>
                      {(group) => (
                        <figure>
                          <Show when={!group.hideLabel}>
                            <figcaption textContent={group.label} class="text-fg/40 mb-2 inline-block text-xs" />
                          </Show>
                          <ul class="space-y-1">
                            <For each={group.pages}>{(page) => <MobileNavLink name={page.name} href={page.href} path={path} />}</For>
                          </ul>
                        </figure>
                      )}
                    </For>
                  </nav>
                  <div class="flex shrink-0 items-center px-2 pt-3">
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
                </Drawer.Content>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </header>
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
    </>
  );
}

function MobileNavLink(props: { name: string; href: string; path: () => string }) {
  return (
    <li>
      <a
        href={props.href}
        textContent={props.name}
        data-active={props.path() === props.href ? "" : undefined}
        class="text-fg/70 hover:bg-fg/5 data-active:bg-fg/10 data-active:text-fg flex h-9 items-center rounded px-2 text-sm"
      />
    </li>
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
