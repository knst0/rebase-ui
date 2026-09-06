import { useLocation } from "@solidjs/router";
import { For, Show, createEffect, createMemo, createSignal, onSettled, type ParentProps } from "solid-js";
import { nav, type NavHeading, type NavItem } from "virtual:components-nav";
import { Icon } from "znaki/solid";

const FLAT_NAV: NavItem[] = nav.flatMap((item) => (item.children ? [item, ...item.children] : [item]));

type HeadingLinkProps = { id: string; title: string; active?: boolean };

function HeadingLink(props: HeadingLinkProps) {
  return (
    <a
      href={`#${props.id}`}
      class={{
        "hover:text-fg block truncate py-1 text-sm transition-colors": true,
        "text-fg font-medium": !!props.active,
        "text-fg/60": !props.active,
      }}
      textContent={props.title}
    />
  );
}

function HeadingList(props: { headings: NavHeading[]; depth: number; activeId: () => string | undefined }) {
  return (
    <ul class={{ "space-y-1": props.depth === 0, "pl-3": props.depth > 0 }}>
      <For each={props.headings}>
        {(heading) => (
          <li>
            <HeadingLink id={heading.id} title={heading.title} active={props.activeId() === heading.id} />
            <Show when={heading.children.length}>
              <HeadingList headings={heading.children} depth={props.depth + 1} activeId={props.activeId} />
            </Show>
          </li>
        )}
      </For>
    </ul>
  );
}

type Segment = { top: number; height: number };

function getHeadingLinks(container: HTMLDivElement) {
  return Array.from(container.querySelectorAll<HTMLAnchorElement>("a[href^='#']"));
}

function ComponentsNav(props: { page: () => NavItem | undefined; headings: () => NavHeading[] }) {
  let listRef: HTMLDivElement | undefined;
  const [geometry, setGeometry] = createSignal({ height: 0, segments: [] as Segment[] });
  const [active, setActive] = createSignal(0);
  const [activeId, setActiveId] = createSignal<string>();

  const measure = () => {
    if (!listRef) return;
    const base = listRef.getBoundingClientRect();
    const links = getHeadingLinks(listRef);

    setGeometry({
      height: listRef.offsetHeight,
      segments: links.map((link) => {
        const rect = link.getBoundingClientRect();
        return { top: rect.top - base.top, height: rect.height };
      }),
    });
  };

  const syncActive = () => {
    if (!listRef) return;
    const links = getHeadingLinks(listRef);
    const offset = 128;
    let nextActive = 0;
    let bestTop = Number.NEGATIVE_INFINITY;

    links.forEach((link, index) => {
      const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
      if (!target) return;
      const top = target.getBoundingClientRect().top;
      if (top <= offset && top > bestTop) {
        bestTop = top;
        nextActive = index;
      }
    });

    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
      nextActive = Math.max(0, links.length - 1);
    }

    setActive(nextActive);
    setActiveId(links[nextActive]?.hash.slice(1));
  };

  createEffect(
    () => props.headings(),
    () => {
      requestAnimationFrame(() => {
        measure();
        syncActive();
      });
    },
  );

  onSettled(() => {
    const observer = new ResizeObserver(() => {
      measure();
      syncActive();
    });

    if (listRef) observer.observe(listRef);
    window.addEventListener("scroll", syncActive, { passive: true });
    measure();
    syncActive();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", syncActive);
    };
  });

  const activeSegment = createMemo(() => geometry().segments[active()]);

  const trackPath = createMemo(() => {
    const segments = geometry().segments;

    if (!segments.length) return "";

    const first = segments[0];
    const last = segments[segments.length - 1];

    return `M3 ${first.top} L3 ${last.top + last.height}`;
  });

  return (
    <nav>
      <span class="text-fg/40 mb-2 inline-flex items-center gap-2 text-xs">
        <Icon name="tabler:align-left" size={16} />
        <span textContent="On this page" />
      </span>
      <div ref={(element) => (listRef = element)} class="relative pl-6">
        <svg class="pointer-events-none absolute top-0 left-0 overflow-visible" width={16} height={geometry().height} aria-hidden="true">
          <path d={trackPath()} class="stroke-fg/20" fill="none" stroke-width={1} />
          <g class="transition-transform duration-300 ease-out" transform={`translate(0 ${activeSegment()?.top ?? 0})`}>
            <rect x="2" y="0" width="3" height={activeSegment()?.height ?? 0} rx="1.5" class="fill-fg" />
          </g>
        </svg>
        <ul>
          <li>
            <Show when={props.page()?.top} fallback={<HeadingLink id={props.headings()[0].id} title="(Top)" active={active() === 0} />}>
              {(top) => <HeadingLink id={top()} title="(Top)" active={active() === 0} />}
            </Show>
          </li>
          <For each={props.headings()}>
            {(heading) => (
              <li>
                <HeadingLink id={heading.id} title={heading.title} active={activeId() === heading.id} />
                <Show when={heading.children.length}>
                  <HeadingList headings={heading.children} depth={1} activeId={activeId} />
                </Show>
              </li>
            )}
          </For>
        </ul>
      </div>
    </nav>
  );
}

export default function ComponentsLayout(props: ParentProps) {
  const location = useLocation();
  const page = createMemo(() => {
    const path = location.pathname.replace(/\/$/, "");
    return FLAT_NAV.find((item) => item.path === path);
  });
  const headings = createMemo(() => page()?.headings ?? []);

  return (
    <>
      <main class="mx-auto mt-12 w-full max-w-[680px] py-20 sm:py-28 lg:mt-0">{props.children}</main>
      <aside class="sticky top-0 h-screen pt-5 pb-4">
        <Show when={headings().length > 0}>
          <ComponentsNav page={page} headings={headings} />
        </Show>
      </aside>
    </>
  );
}
