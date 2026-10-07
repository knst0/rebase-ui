import { Input } from "@rebase-ui/solid/input";

export default function ExampleInput() {
  return (
    <label class="flex flex-col items-start gap-1 text-sm font-bold text-neutral-950 dark:text-white">
      Name
      <Input
        placeholder="e.g. Colm Tuite"
        class="h-8 w-40 border border-neutral-950 bg-white px-2 text-sm font-normal text-neutral-950 placeholder:text-neutral-500 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:border-white dark:bg-neutral-950 dark:text-white dark:placeholder:text-neutral-400 dark:focus:outline-white any-pointer-coarse:text-base"
      />
    </label>
  );
}
