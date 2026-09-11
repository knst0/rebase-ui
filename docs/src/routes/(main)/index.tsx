import { For, lazy } from "solid-js";

type DemoModule = typeof import("./components/accordion/_demos/hero");

type ComponentItem = {
  name: string;
  url: string;
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
      component: lazy(loader),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

function ComponentCard(props: ComponentItem) {
  return (
    <li class="border-border relative flex aspect-square items-center justify-center border-r border-b">
      <a href={props.url} class="text-gray-11 hover:text-gray-12 absolute top-4 left-4 transition-colors" textContent={props.name} />
      <props.component />
    </li>
  );
}

export default function Home() {
  return (
    <main class="col-span-2 m-4 lg:m-16">
      <ul class="border-border grid border-t border-l md:grid-cols-[repeat(auto-fit,minmax(380px,1fr))]">
        <For each={components}>{(component) => <ComponentCard {...component} />}</For>
      </ul>
    </main>
  );
}
