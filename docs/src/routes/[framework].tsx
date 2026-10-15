import { Drawer } from "@rebase-ui/solid/drawer";
import { Tabs } from "@rebase-ui/solid/tabs";
import { useBeforeLeave, useLocation, useNavigate, useParams } from "@solidjs/router";
import { For, type ParentProps, Show, createEffect, createMemo, createSignal, onSettled } from "solid-js";
import { nav } from "virtual:components-nav";
import { Icon } from "znaki/solid";

import { FluidHoverHighlight, createFluidHover } from "../components/FluidHover";
import {
  BASE,
  FRAMEWORKS,
  findFramework,
  frameworkHref,
  preferredFramework,
  rememberFramework,
  type Framework,
  type FrameworkId,
} from "../framework";
import NotFound from "./[framework]/[...404]";

const GITHUB_REPO = "knst0/rebase-ui";

const GROUPS = [
  {
    id: "main",
    label: "Main",
    hideLabel: true,
    pages: [{ name: "Showcase", path: "/" }],
  },
  {
    id: "components",
    label: "Components",
    pages: nav.map((item) => ({ name: item.title, path: item.path })),
  },
];

export default function FrameworkLayout(props: ParentProps) {
  const params = useParams<{ framework: string }>();
  const framework = createMemo(() => findFramework(params.framework));

  return (
    <Show when={framework()} fallback={params.framework === "components" ? <LegacyRedirect /> : <NotFound />}>
      {(current) => <MainLayout framework={current()}>{props.children}</MainLayout>}
    </Show>
  );
}

/** Pre-framework URLs (`/components/dialog`) land on the same page of the preferred framework. */
function LegacyRedirect() {
  const location = useLocation();
  const navigate = useNavigate();
  onSettled(() => {
    navigate(`/${preferredFramework()}${location.pathname.slice(BASE.length)}${location.hash}`, { replace: true });
  });
  return null;
}

function MainLayout(props: ParentProps<{ framework: Framework }>) {
  const location = useLocation();
  const [open, setOpen] = createSignal(false);
  /** Framework-relative path of the current page: `/components/dialog`. */
  const path = createMemo(() => location.pathname.slice(BASE.length).replace(/\/$/, "").slice(`/${props.framework.id}`.length) || "/");

  createEffect(
    () => props.framework.id,
    (id) => rememberFramework(id),
  );

  useBeforeLeave(() => {
    setOpen(false);
  });

  return (
    <>
      <header class="bg-bg border-border sticky top-0 z-40 flex h-14 items-center justify-between border-b px-4 lg:hidden">
        <a href={frameworkHref(props.framework.id, "/")} class="text-sm font-semibold tracking-tight">
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
                  <FrameworkSwitch path={path} class="mb-3" />
                  <nav class="flex grow flex-col gap-5 overflow-y-auto py-2">
                    <For each={GROUPS}>
                      {(group) => (
                        <figure>
                          <Show when={!group.hideLabel}>
                            <figcaption textContent={group.label} class="text-fg/40 mb-2 inline-block text-xs" />
                          </Show>
                          <ul class="space-y-1">
                            <For each={group.pages}>
                              {(page) => <MobileNavLink name={page.name} href={frameworkHref(props.framework.id, page.path)} />}
                            </For>
                          </ul>
                        </figure>
                      )}
                    </For>
                  </nav>
                  <SidebarFooter framework={props.framework} class="px-2 pt-3" />
                </Drawer.Content>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </header>
      <div class="relative lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside class="dotted-right sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col lg:flex">
          <FrameworkSwitch path={path} class="mx-5 mt-5" />
          <SidebarNav framework={props.framework.id} path={path} />
          <SidebarFooter framework={props.framework} class="px-5 pt-3 pb-4" />
        </aside>
        {props.children}
      </div>
    </>
  );
}

function SidebarNav(props: { framework: FrameworkId; path: () => string }) {
  const hover = createFluidHover();

  return (
    <div class="grow overflow-y-auto pt-5 pb-4">
      <Tabs.Root value={props.path()}>
        <Tabs.List
          as="nav"
          ref={hover.ref}
          class="relative flex flex-col gap-5"
          onMouseEnter={hover.handlers.onMouseEnter}
          onMouseMove={hover.handlers.onMouseMove}
          onMouseLeave={hover.handlers.onMouseLeave}
          onClick={hover.handlers.onClick}
        >
          <FluidHoverHighlight
            hover={hover}
            from={() => hover.rectOf("[data-fluid-hover-item][aria-current=page]")}
            class="bg-fg/5 rounded"
          />
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
                          value={page.path}
                          href={frameworkHref(props.framework, page.path)}
                          textContent={page.name}
                          data-fluid-hover-item=""
                          class="text-fg/70 aria-[current=page]:bg-fg/10 aria-[current=page]:text-fg data-fluid-hover-active:text-fg relative -ml-2 flex h-7 items-center rounded px-2 text-sm transition-colors"
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
  );
}

/** Switches to the same page of another framework; the router marks the current one with `aria-current`. */
function FrameworkSwitch(props: { path: () => string; class?: string }) {
  const location = useLocation();

  return (
    <nav aria-label="Framework" class={["border-border flex rounded border p-0.5", props.class]}>
      <For each={FRAMEWORKS}>
        {(item) => (
          <a
            href={`${frameworkHref(item.id, props.path())}${location.hash}`}
            textContent={item.name}
            class="text-fg/60 hover:text-fg aria-[current=page]:bg-fg/10 aria-[current=page]:text-fg flex h-7 flex-1 items-center justify-center rounded-[3px] text-sm transition-colors"
          />
        )}
      </For>
    </nav>
  );
}

function SidebarFooter(props: { framework: Framework; class?: string }) {
  return (
    <div class={["flex shrink-0 flex-col gap-2", props.class]}>
      <FooterLink href={`https://github.com/${GITHUB_REPO}`} label={`${GITHUB_REPO} on GitHub`} text={GITHUB_REPO}>
        <Icon name="tabler:brand-github" size={16} />
      </FooterLink>
      <FooterLink
        href={`https://www.npmjs.com/package/${props.framework.packageName}`}
        label={`${props.framework.packageName} v${props.framework.version} on npm`}
        text={`v${props.framework.version}`}
      >
        <Icon name="tabler:brand-npm" size={16} />
      </FooterLink>
    </div>
  );
}

function FooterLink(props: ParentProps<{ href: string; label: string; text: string }>) {
  return (
    <a
      href={props.href}
      target="_blank"
      rel="noreferrer"
      aria-label={props.label}
      class="text-fg/40 hover:text-fg inline-flex items-center gap-1.5 rounded text-xs transition-colors"
    >
      {props.children}
      <span textContent={props.text} class="tabular-nums" />
    </a>
  );
}

/** The router marks the current page's link with `aria-current="page"`. */
function MobileNavLink(props: { name: string; href: string }) {
  return (
    <li>
      <a
        href={props.href}
        textContent={props.name}
        class="text-fg/70 hover:bg-fg/5 aria-[current=page]:bg-fg/10 aria-[current=page]:text-fg flex h-9 items-center rounded px-2 text-sm"
      />
    </li>
  );
}
