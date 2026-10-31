import { Progress } from "@rebase-ui/solid/progress";
import { createSignal, onCleanup } from "solid-js";

export default function ExampleProgress() {
  const [value, setValue] = createSignal(20);

  // Simulate changing progress.
  const interval = setInterval(() => {
    setValue((current) => Math.min(100, Math.round(current + Math.random() * 25)));
  }, 1000);
  onCleanup(() => clearInterval(interval));

  return (
    <Progress.Root class="grid w-60 max-w-full grid-cols-2 gap-y-2" value={value()}>
      <Progress.Label class="text-sm font-normal text-neutral-950 dark:text-white">Export data</Progress.Label>
      <Progress.Value class="text-right text-sm text-neutral-950 dark:text-white" />
      <Progress.Track class="col-span-2 h-1 overflow-hidden bg-neutral-200 dark:bg-neutral-800">
        <Progress.Indicator class="bg-neutral-950 transition-[width] duration-500 dark:bg-white" />
      </Progress.Track>
    </Progress.Root>
  );
}
