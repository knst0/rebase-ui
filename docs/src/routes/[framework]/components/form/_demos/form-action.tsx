import { Button } from "@rebase-ui/solid/button";
import { Field } from "@rebase-ui/solid/field";
import { Form } from "@rebase-ui/solid/form";
import { action, createSignal, isPending } from "solid-js";

// Add `'use server'` to the body to turn this into a Server Function
async function checkUsername(username: string): Promise<Form.Props["errors"]> {
  await new Promise((resolve) => {
    setTimeout(resolve, 1000);
  });

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
  const [errors, setErrors] = createSignal<Form.Props["errors"]>({});

  const submit = action(async function* (formValues: Form.Values) {
    setErrors({});

    const serverErrors = await checkUsername(formValues.username);
    yield;

    setErrors(serverErrors);
  });

  return (
    <Form class="flex w-full max-w-64 flex-col gap-4" errors={errors()} onFormSubmit={submit}>
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
        disabled={isPending(errors)}
        focusableWhenDisabled
        class="flex h-8 items-center justify-center gap-2 rounded-none border border-neutral-950 bg-white px-3 text-sm leading-none font-normal whitespace-nowrap text-neutral-950 select-none hover:not-data-disabled:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 active:not-data-disabled:bg-neutral-200 disabled:border-neutral-500 disabled:text-neutral-500 data-disabled:border-neutral-500 data-disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-data-disabled:bg-neutral-800 dark:focus-visible:outline-white dark:active:not-data-disabled:bg-neutral-700 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400"
      >
        Submit
      </Button>
    </Form>
  );
}
