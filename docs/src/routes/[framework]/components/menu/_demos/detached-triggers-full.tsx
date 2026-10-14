import { Menu } from "@rebase-ui/solid/menu";
import { createMemo, For } from "solid-js";

type MenuContent = {
  heading: string;
  groups: string[][];
};

const MENUS = {
  library: {
    heading: "Library",
    groups: [
      ["Add to library", "Add to favorites"],
      ["Create playlist", "Create station"],
    ],
  },
  playback: {
    heading: "Playback",
    groups: [
      ["Play now", "Add to queue"],
      ["Play next", "Play last", "Sleep timer"],
    ],
  },
  share: {
    heading: "Share",
    groups: [
      ["Copy link", "Copy embed code"],
      ["Share to contacts", "Share to social"],
    ],
  },
} as const satisfies Record<string, MenuContent>;

type MenuKey = keyof typeof MENUS;

const demoMenu = Menu.createHandle<MenuKey>();

export default function MenuDetachedTriggersFullDemo() {
  return (
    <div class="flex flex-wrap items-center gap-2">
      <Menu.Trigger handle={demoMenu} payload={"library" as const} class={triggerClass}>
        Library
      </Menu.Trigger>
      <Menu.Trigger handle={demoMenu} payload={"playback" as const} class={triggerClass}>
        Playback
      </Menu.Trigger>
      <Menu.Trigger handle={demoMenu} payload={"share" as const} class={triggerClass}>
        Share
      </Menu.Trigger>

      <Menu.Root handle={demoMenu} modal={false}>
        {(args) => (
          <Menu.Portal>
            <Menu.Positioner sideOffset={8} align="start" class={`
                h-[var(--positioner-height)]
                w-[var(--positioner-width)] max-w-[var(--available-width)] transition-[top,left,right,bottom,transform]
                duration-[0.35s]
                ease-[cubic-bezier(0.22,1,0.36,1)] outline-none
                data-instant:transition-none
              `}>
              <Menu.Popup class={`
                  relative h-[var(--popup-height,auto)] w-[var(--popup-width,auto)] origin-[var(--transform-origin)]
                  border border-neutral-950 bg-white
                  py-1 text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 transition-[width,height,opacity,scale]
                  duration-[0.35s]
                  ease-[cubic-bezier(0.22,1,0.36,1)] outline-none
                  data-ending-style:scale-90 data-ending-style:opacity-0
                  data-instant:transition-none data-starting-style:scale-90
                  data-starting-style:opacity-0
                  dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none
                `}>
                <Menu.Viewport class={`
                    relative h-full w-full overflow-clip
                    p-0
                    [&_[data-current]]:w-[var(--popup-width)]
                    [&_[data-current]]:translate-x-0 [&_[data-current]]:opacity-100
                    [&_[data-current]]:transition-[translate,opacity]
                    [&_[data-current]]:duration-[350ms,175ms]
                    [&_[data-current]]:ease-[cubic-bezier(0.22,1,0.36,1)]
                    data-[activation-direction~='left']:[&_[data-current][data-starting-style]]:-translate-x-1/2
                    data-[activation-direction~='left']:[&_[data-current][data-starting-style]]:opacity-0
                    data-[activation-direction~='right']:[&_[data-current][data-starting-style]]:translate-x-1/2
                    data-[activation-direction~='right']:[&_[data-current][data-starting-style]]:opacity-0
                    [&_[data-previous]]:w-[var(--popup-width)]
                    [&_[data-previous]]:translate-x-0 [&_[data-previous]]:opacity-100
                    [&_[data-previous]]:transition-[translate,opacity]
                    [&_[data-previous]]:duration-[350ms,175ms]
                    [&_[data-previous]]:ease-[cubic-bezier(0.22,1,0.36,1)]
                    data-[activation-direction~='left']:[&_[data-previous][data-ending-style]]:translate-x-1/2
                    data-[activation-direction~='left']:[&_[data-previous][data-ending-style]]:opacity-0
                    data-[activation-direction~='right']:[&_[data-previous][data-ending-style]]:-translate-x-1/2
                    data-[activation-direction~='right']:[&_[data-previous][data-ending-style]]:opacity-0
                  `}>
                  <For keyed={false} each={args.payload ? MENUS[args.payload].groups : []}>
                    {(group, groupIndex) => {
                      const section = createMemo(() => ({ items: group(), index: groupIndex }));
                      return (
                        <MenuGroupSection
                          items={section().items}
                          index={section().index}
                          total={args.payload ? MENUS[args.payload].groups.length : 0}
                          heading={args.payload ? MENUS[args.payload].heading : ""}
                        />
                      );
                    }}
                  </For>
                </Menu.Viewport>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        )}
      </Menu.Root>
    </div>
  );
}

function MenuGroupSection(props: { items: string[]; index: number; total: number; heading: string }) {
  return (
    <>
      <Menu.Group>
        {props.index === 0 && (
          <Menu.GroupLabel class="px-4 py-2 text-sm leading-4 text-neutral-500 select-none dark:text-neutral-400">
            {props.heading}
          </Menu.GroupLabel>
        )}
        <For keyed={false} each={props.items}>
          {(item) => {
            const label = createMemo(() => item());
            return <Menu.Item class={itemClass}>{label()}</Menu.Item>;
          }}
        </For>
      </Menu.Group>
      {props.index < props.total - 1 && <Menu.Separator class="mx-1 my-1 h-px bg-neutral-950 dark:bg-white" />}
    </>
  );
}

const itemClass =
  "flex cursor-default py-2 pr-8 pl-4 text-sm leading-4 outline-hidden select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] data-disabled:text-neutral-500 dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white dark:data-disabled:text-neutral-400";
const triggerClass =
  "flex h-8 cursor-default items-center justify-center gap-1.5 rounded-none border border-neutral-950 bg-white px-3 text-sm leading-none font-normal whitespace-nowrap text-neutral-950 select-none hover:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 active:bg-neutral-200 data-pressed:bg-neutral-100 data-disabled:opacity-50 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:bg-neutral-800 dark:active:bg-neutral-700 dark:data-pressed:bg-neutral-800 dark:focus-visible:outline-white";
