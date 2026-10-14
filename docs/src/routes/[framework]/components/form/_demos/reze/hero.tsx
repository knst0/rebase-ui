import { Button } from "@rebase-ui/reze/button";
import { Field } from "@rebase-ui/reze/field";
import { Form } from "@rebase-ui/reze/form";
import { signal } from "reze-js";

export default function ExampleForm() {
  let errors: Form.Props["errors"] = signal({});
  let loading = signal(false);

  return (
    <Form
      class="flex w-full max-w-64 flex-col gap-4"
      errors={errors}
      onSubmit={async (event: SubmitEvent) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget as HTMLFormElement);
        const value = formData.get("url") as string;

        loading = true;
        const response = await submitForm(value);

        errors = response.error ? { url: response.error } : {};
        loading = false;
      }}
    >
      <Field.Root name="url" class="flex flex-col items-start gap-1">
        <Field.Label class="text-sm font-bold text-neutral-950 dark:text-white">Homepage</Field.Label>
        <Field.Control
          type="url"
          required
          defaultValue="https://example.com"
          placeholder="https://example.com"
          pattern="https?://.*"
          class="h-8 w-full border border-neutral-950 bg-white px-2 text-sm font-normal text-neutral-950 placeholder:text-neutral-500 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:border-white dark:bg-neutral-950 dark:text-white dark:placeholder:text-neutral-400 dark:focus:outline-white any-pointer-coarse:text-base"
        />
        <Field.Error class="text-sm text-red-700 dark:text-red-400" />
      </Field.Root>
      <Button
        disabled={loading}
        focusableWhenDisabled
        type="submit"
        class="flex h-8 items-center justify-center gap-2 rounded-none border border-neutral-950 bg-white px-3 text-sm leading-none font-normal whitespace-nowrap text-neutral-950 select-none hover:not-data-disabled:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 active:not-data-disabled:bg-neutral-200 disabled:border-neutral-500 disabled:text-neutral-500 data-disabled:border-neutral-500 data-disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-data-disabled:bg-neutral-800 dark:focus-visible:outline-white dark:active:not-data-disabled:bg-neutral-700 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400"
      >
        Submit
      </Button>
    </Form>
  );
}

async function submitForm(value: string): Promise<{ error?: string }> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, 1000);
  await promise;

  try {
    const url = new URL(value);

    if (url.hostname.endsWith("example.com")) {
      return { error: "The example domain is not allowed" };
    }
  } catch {
    return { error: "This is not a valid URL" };
  }

  return {};
}
