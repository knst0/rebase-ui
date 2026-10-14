import { For, Show, createMemo, createSignal, onSettled } from "solid-js";
import { Icon } from "znaki/solid";

import { titleFromSlug } from "../../../plugins/shared/text";
import { DemoPreview, type DemoLoader } from "../../components/DemoPreview";
import { frameworkHref, useFramework, type FrameworkId } from "../../framework";

type ComponentItem = {
  slug: string;
  name: string;
  order: number;
  load: DemoLoader;
};

const HERO_DEMOS: Record<FrameworkId, Record<string, DemoLoader>> = {
  solid: import.meta.glob<{ default: unknown }>("./components/*/_demos/hero.tsx"),
  reze: import.meta.glob<{ default: unknown }>("./components/*/_demos/reze/hero.tsx"),
};

function heroComponents(demos: Record<string, DemoLoader>): ComponentItem[] {
  return Object.entries(demos)
    .flatMap(([path, load]) => {
      const slug = path.match(/\/components\/([^/]+)\/_demos\//)?.[1];
      return slug === undefined ? [] : { slug, name: titleFromSlug(slug), order: 0, load };
    })
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((item, order) => ({ ...item, order }));
}

const COMPONENTS: Record<FrameworkId, ComponentItem[]> = {
  solid: heroComponents(HERO_DEMOS.solid),
  reze: heroComponents(HERO_DEMOS.reze),
};

function Spinner() {
  return <Icon name="tabler:loader-2" size={24} class="text-fg/30 animate-spin" />;
}

function ComponentCard(props: ComponentItem & { framework: FrameworkId; ready: () => boolean }) {
  return (
    <li class="border-border relative flex aspect-square items-center justify-center border-r border-b">
      <a
        href={frameworkHref(props.framework, `/components/${props.slug}`)}
        class="text-gray-11 hover:text-gray-12 absolute top-4 left-4 transition-colors"
        textContent={props.name}
      />
      <Show when={props.ready()} fallback={<Spinner />}>
        <DemoPreview framework={props.framework} load={props.load} fallback={<Spinner />} />
      </Show>
    </li>
  );
}

const INITIAL_BUDGET = 4;
const TOTAL = Math.max(...Object.values(COMPONENTS).map((items) => items.length));

export default function Home() {
  const framework = useFramework();
  const components = createMemo(() => COMPONENTS[framework().id]);
  const [budget, setBudget] = createSignal(INITIAL_BUDGET);
  onSettled(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    const tick = () => {
      cleanup = undefined;
      if (cancelled || budget() >= TOTAL) return;
      setBudget((value) => Math.min(value + 1, TOTAL));
      schedule();
    };

    const schedule = () => {
      if (cancelled || budget() >= TOTAL) return;
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
        <For each={components()}>
          {(component) => <ComponentCard {...component} framework={framework().id} ready={() => component.order < budget()} />}
        </For>
      </ul>
    </main>
  );
}
