import { Button } from "@rebase-ui/reze/button";
import { Field } from "@rebase-ui/reze/field";
import { Form } from "@rebase-ui/reze/form";
import { action, signal } from "reze-js";

async function checkUsername(username: string): Promise<Form.Props["errors"]> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, 1000);
  await promise;

  if (username === "admin") {
    return { username: "'admin' is reserved for system use" };
  }

  // 50% chance the username is taken
  if (Math.random() <= 0.5) {
    return { username: `${username} is unavailable` };
  }

  return {};
}

export default function ActionStateForm() {
  let errors: Form.Props["errors"] = signal({});

  const submit = action(async (formValues: Form.Values) => {
    errors = {};

    const serverErrors = await checkUsername(formValues.username);

    errors = serverErrors;
  });

  return (
    <Form class="flex w-full max-w-64 flex-col gap-4" errors={errors} onFormSubmit={submit}>
      <Field.Root name="username" class="flex flex-col items-start gap-1">
        <Field.Label class="text-sm font-bold text-neutral-950 dark:text-white">Username</Field.Label>
        <Field.Control
          type="text"
          autocomplete="username"
          required
          defaultValue="admin"
          placeholder="e.g. alice132"
          class="h-8 w-full border border-neutral-950 bg-white px-2 text-sm font-normal text-neutral-950 placeholder:text-neutral-500 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:border-white dark:bg-neutral-950 dark:text-white dark:placeholder:text-neutral-400 dark:focus:outline-white any-pointer-coarse:text-base"
        />
        <Field.Error class="text-sm text-red-700 dark:text-red-400" />
      </Field.Root>
      <Button
        type="submit"
        disabled={submit.pending > 0}
        focusableWhenDisabled
        class="flex h-8 items-center justify-center gap-2 rounded-none border border-neutral-950 bg-white px-3 text-sm leading-none font-normal whitespace-nowrap text-neutral-950 select-none hover:not-data-disabled:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 active:not-data-disabled:bg-neutral-200 disabled:border-neutral-500 disabled:text-neutral-500 data-disabled:border-neutral-500 data-disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-data-disabled:bg-neutral-800 dark:focus-visible:outline-white dark:active:not-data-disabled:bg-neutral-700 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400"
      >
        Submit
      </Button>
    </Form>
  );
}
