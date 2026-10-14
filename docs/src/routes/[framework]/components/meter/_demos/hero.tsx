import { Meter } from "@rebase-ui/solid/meter";

export default function ExampleMeter() {
  return (
    <Meter.Root class="grid w-60 max-w-full grid-cols-2 gap-y-2" value={24}>
      <Meter.Label class="text-sm font-normal text-neutral-950 dark:text-white">Storage Used</Meter.Label>
      <Meter.Value class="text-right text-sm text-neutral-950 dark:text-white" />
      <Meter.Track class="col-span-2 h-3 overflow-hidden bg-neutral-200 dark:bg-neutral-800">
        <Meter.Indicator class="bg-neutral-950 transition-[width] duration-500 dark:bg-white" />
      </Meter.Track>
    </Meter.Root>
  );
}
