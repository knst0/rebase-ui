import { For, Loading, Show, createSignal, lazy, onSettled } from "solid-js";
import { Icon } from "znaki/solid";

type DemoModule = typeof import("./components/accordion/_demos/hero");

type ComponentItem = {
  name: string;
  url: string;
  order: number;
  component: ReturnType<typeof lazy>;
};

const demoModules = import.meta.glob<DemoModule>("./components/*/_demos/hero.tsx");

function getSlug(path: string): string | undefined {
  return path.match(/\/components\/([^/]+)\/_demos\//)?.[1];
}

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

const components: ComponentItem[] = Object.entries(demoModules)
  .flatMap(([path, loader]) => {
    const slug = getSlug(path);

    if (!slug) return [];

    return {
      name: titleFromSlug(slug),
      url: `${base}/components/${slug}`,
      order: 0,
      component: lazy(loader),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((item, order) => ({ ...item, order }));

function Spinner() {
  return <Icon name="tabler:loader-2" size={24} class="text-fg/30 animate-spin" />;
}

function ComponentCard(props: ComponentItem & { ready: () => boolean }) {
  return (
    <li class="border-border relative flex aspect-square items-center justify-center border-r border-b">
      <a href={props.url} class="text-gray-11 hover:text-gray-12 absolute top-4 left-4 transition-colors" textContent={props.name} />
      <Show when={props.ready()} fallback={<Spinner />}>
        <Loading fallback={<Spinner />}>
          <props.component />
        </Loading>
      </Show>
    </li>
  );
}

const INITIAL_BUDGET = 4;

export default function Home() {
  const [budget, setBudget] = createSignal(INITIAL_BUDGET);
  onSettled(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    const tick = () => {
      cleanup = undefined;
      if (cancelled || budget() >= components.length) return;
      setBudget((value) => Math.min(value + 1, components.length));
      schedule();
    };

    const schedule = () => {
      if (cancelled || budget() >= components.length) return;
      if (typeof requestIdleCallback !== "undefined") {
        const id = requestIdleCallback(tick, { timeout: 500 });
        cleanup = () => cancelIdleCallback(id);
      } else {
        const id = setTimeout(tick, 16);
        cleanup = () => clearTimeout(id);
      }
    };

    schedule();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  });

  return (
    <main class="m-4 lg:m-16">
      <ul class="border-border grid border-t border-l md:grid-cols-[repeat(auto-fit,minmax(380px,1fr))]">
        <For each={components}>{(component) => <ComponentCard {...component} ready={() => component.order < budget()} />}</For>
      </ul>
    </main>
  );
}
