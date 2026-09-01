import { For } from "solid-js";

import { Separator } from "#components";

export default function Home() {
  return (
    <main class="m-4 lg:m-16">
      <ul class="border-gray-6 grid grid-cols-1 border-t border-l md:grid-cols-[repeat(auto-fit,minmax(380px,1fr))]">
        <For each={COMPONENTS}>
          {(item) => (
            <li class="border-gray-6 relative flex aspect-square items-center justify-center border-r border-b">
              <a class="text-gray-11 absolute top-4 left-4" href={item.url} textContent={item.name} />
              {item.component}
            </li>
          )}
        </For>
      </ul>
    </main>
  );
}

const COMPONENTS = [
  {
    name: "Separator",
    url: "/components/separator",
    component: () => (
      <div class="flex gap-4">
        <p>Home</p>
        <Separator orientation="vertical" />
        <p>Log in</p>
        <p>Sign up</p>
      </div>
    ),
  },
] as const;
