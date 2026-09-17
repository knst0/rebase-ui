import { Select } from "@rebase-ui/solid/select";
import type { ComponentProps } from "@solidjs/web";
import { For } from "solid-js";

export default function ObjectValueSelect() {
  return (
    <div class="flex flex-col items-start gap-1">
      <Select.Root defaultValue={shippingMethods[0]} itemToStringValue={(item) => item.id}>
        <Select.Label class="cursor-default text-sm font-bold text-neutral-950 dark:text-white">Shipping method</Select.Label>
        <Select.Trigger class="flex min-h-8 min-w-[16rem] items-center justify-between gap-3 border border-neutral-950 bg-white py-1.5 pr-1 pl-2 text-sm leading-none font-normal whitespace-nowrap text-neutral-950 select-none hover:not-data-disabled:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 active:not-data-disabled:bg-neutral-200 disabled:border-neutral-500 disabled:text-neutral-500 data-disabled:border-neutral-500 data-disabled:text-neutral-500 data-pressed:bg-neutral-100 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-data-disabled:bg-neutral-800 dark:focus-visible:outline-white dark:active:not-data-disabled:bg-neutral-700 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400 dark:data-pressed:bg-neutral-800">
          <Select.Value>
            {(method: ShippingMethod) => (
              <span class="flex flex-col items-start gap-0.5">
                <span class="text-sm">{method.name}</span>
                <span class="text-xs text-neutral-600 dark:text-neutral-400">
                  {method.duration} ({method.price})
                </span>
              </span>
            )}
          </Select.Value>
          <Select.Icon>
            <CaretUpDownIcon aria-hidden="true" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner class="z-10 outline-hidden select-none" sideOffset={4}>
            <Select.Popup class="group min-w-[var(--anchor-width)] origin-[var(--transform-origin)] border border-neutral-950 bg-white bg-clip-padding text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 outline-hidden transition-[scale,opacity] duration-100 ease-out data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 data-[side=none]:min-w-[calc(var(--anchor-width)+1.75rem)] data-[side=none]:translate-y-px data-[side=none]:data-ending-style:transition-none data-[side=none]:data-starting-style:scale-100 data-[side=none]:data-starting-style:opacity-100 data-[side=none]:data-starting-style:transition-none dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none">
              <Select.ScrollUpArrow class="top-0 z-[1] flex h-4 w-full cursor-default items-center justify-center bg-white text-center text-xs before:absolute before:left-0 before:h-full before:w-full before:content-[''] data-[side=none]:before:top-[-100%] dark:bg-neutral-950">
                <CaretUpIcon aria-hidden="true" />
              </Select.ScrollUpArrow>
              <Select.List class="relative max-h-[var(--available-height)] scroll-py-6 overflow-y-auto py-1">
                <For each={shippingMethods}>
                  {(method) => (
                    <Select.Item
                      value={method}
                      class="group/item grid cursor-default grid-cols-[1rem_1fr] items-start gap-2 py-1.5 pr-4 pl-2.5 text-sm outline-hidden select-none data-highlighted:bg-neutral-950 data-highlighted:text-white dark:data-highlighted:bg-white dark:data-highlighted:text-neutral-950"
                    >
                      <Select.ItemIndicator class="relative top-[0.4em] col-start-1 flex items-center justify-center self-start">
                        <CheckIcon aria-hidden="true" />
                      </Select.ItemIndicator>
                      <Select.ItemText class="col-start-2 flex flex-col gap-0.5">
                        <span class="text-sm">{method.name}</span>
                        <span class="text-xs text-neutral-600 group-data-highlighted/item:text-neutral-400 dark:text-neutral-400 dark:group-data-highlighted/item:text-neutral-600">
                          {method.duration} ({method.price})
                        </span>
                      </Select.ItemText>
                    </Select.Item>
                  )}
                </For>
              </Select.List>
              <Select.ScrollDownArrow class="bottom-0 z-[1] flex h-4 w-full cursor-default items-center justify-center bg-white text-center text-xs before:absolute before:left-0 before:h-full before:w-full before:content-[''] data-[side=none]:before:bottom-[-100%] dark:bg-neutral-950">
                <CaretDownIcon aria-hidden="true" />
              </Select.ScrollDownArrow>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}

function CaretUpDownIcon(props: ComponentProps<"svg">) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" {...props} style={{ display: "block", ...props.style }}>
      <path d="M11 10H5l3 3.5zm0-4H5l3-3.5z" />
    </svg>
  );
}

function CheckIcon(props: ComponentProps<"svg">) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      {...props}
      style={{ display: "block", ...props.style }}
    >
      <path d="m2.5 8.5 4 4 7-9" />
    </svg>
  );
}

interface ShippingMethod {
  id: string;
  name: string;
  duration: string;
  price: string;
}

const shippingMethods: ShippingMethod[] = [
  {
    id: "standard",
    name: "Standard",
    duration: "Delivers in 4-6 business days",
    price: "$4.99",
  },
  {
    id: "express",
    name: "Express",
    duration: "Delivers in 2-3 business days",
    price: "$9.99",
  },
  {
    id: "overnight",
    name: "Overnight",
    duration: "Delivers next business day",
    price: "$19.99",
  },
];

function CaretUpIcon(props: ComponentProps<"svg">) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" {...props} style={{ display: "block", ...props.style }}>
      <path d="M12 10H4l4-4.5z" />
    </svg>
  );
}

function CaretDownIcon(props: ComponentProps<"svg">) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" {...props} style={{ display: "block", ...props.style }}>
      <path d="M12 6H4l4 4.5z" />
    </svg>
  );
}
