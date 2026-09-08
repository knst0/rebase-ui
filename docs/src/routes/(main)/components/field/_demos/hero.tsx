import { Field } from "@rebase-ui/solid/field";

export default function ExampleField() {
  return (
    <Field.Root class="flex w-full max-w-64 flex-col items-start gap-1">
      <Field.Label class="text-sm font-bold text-neutral-950 dark:text-white">Name</Field.Label>
      <Field.Control
        required
        placeholder="Required"
        class="h-8 self-stretch border border-neutral-950 bg-white px-2 text-sm font-normal text-neutral-950 placeholder:text-neutral-500 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:border-white dark:bg-neutral-950 dark:text-white dark:placeholder:text-neutral-400 dark:focus:outline-white any-pointer-coarse:text-base"
      />
      <Field.Error class="text-sm text-red-700 dark:text-red-400" match="valueMissing">
        Please enter your name
      </Field.Error>

      <Field.Description class="text-sm text-neutral-600 dark:text-neutral-400">Visible on your profile</Field.Description>
    </Field.Root>
  );
}
