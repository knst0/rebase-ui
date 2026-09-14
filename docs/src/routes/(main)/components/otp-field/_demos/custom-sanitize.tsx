import { OTPField } from "@rebase-ui/solid/otp-field";
import { createMemo, createSignal, createUniqueId, For, onCleanup } from "solid-js";

const CODE_LENGTH = 6;

function normalizeRecoveryCode(value: string) {
  return value.toUpperCase();
}

export default function OTPFieldCustomNormalizeDemo() {
  const id = createUniqueId();
  const descriptionId = `${id}-description`;

  const [focusedIndex, setFocusedIndex] = createSignal(0);
  const [invalidPulse, setInvalidPulse] = createSignal(0);
  const [statusMessage, setStatusMessage] = createSignal("");
  let invalidTimeout: ReturnType<typeof setTimeout> | undefined;
  let skipClearOnNextValueChange = false;

  onCleanup(() => {
    clearTimeout(invalidTimeout);
  });

  function clearInvalidFeedback() {
    clearTimeout(invalidTimeout);
    invalidTimeout = undefined;
    setInvalidPulse(0);
    setStatusMessage("");
  }

  function handleValueChange() {
    if (skipClearOnNextValueChange) {
      skipClearOnNextValueChange = false;
      return;
    }

    clearInvalidFeedback();
  }

  function handleValueInvalid(value: string) {
    skipClearOnNextValueChange = true;
    setInvalidPulse((current) => current + 1);
    setStatusMessage(`Unsupported characters were ignored from ${value}.`);

    clearTimeout(invalidTimeout);
    invalidTimeout = setTimeout(() => {
      invalidTimeout = undefined;
      setInvalidPulse(0);
    }, 400);
  }

  const activeInvalidIndex = () => (invalidPulse() > 0 ? focusedIndex() : -1);

  return (
    <div class="flex w-full max-w-80 flex-col items-start gap-1">
      <label for={id} class="text-sm font-bold text-neutral-950 dark:text-white">
        Recovery code
      </label>
      <OTPField.Root
        id={id}
        length={CODE_LENGTH}
        validationType="alphanumeric"
        normalizeValue={normalizeRecoveryCode}
        onValueChange={handleValueChange}
        onValueInvalid={handleValueInvalid}
        aria-describedby={descriptionId}
        class="flex w-full gap-2"
      >
        <For each={Array.from({ length: CODE_LENGTH })}>
          {(_, index) => {
            const i = createMemo(() => index());
            return (
              <OTPField.Input
                class={[
                  "m-0 h-10 w-10 rounded-none border bg-white dark:bg-neutral-950 text-center font-inherit text-base font-normal text-neutral-950 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:focus:outline-white dark:border-white dark:text-white",
                  activeInvalidIndex() === i()
                    ? "border-red-500 outline-2 outline-red-500 dark:border-red-400 dark:outline-red-400"
                    : "border-neutral-950",
                ]}
                aria-label={i() === 0 ? undefined : `Character ${i() + 1} of ${CODE_LENGTH}`}
                onFocus={() => {
                  setFocusedIndex(i());
                }}
              />
            );
          }}
        </For>
      </OTPField.Root>
      <p id={descriptionId} class="m-0 text-sm text-neutral-600 dark:text-neutral-400">
        Letters and digits only. Letters are converted to uppercase.
      </p>
      <span aria-live="polite" class="sr-only">
        {statusMessage()}
      </span>
    </div>
  );
}
