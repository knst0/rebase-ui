import { OTPField } from "@rebase-ui/reze/otp-field";
import { computed, createUniqueId, For, onCleanup, signal } from "reze-js";

const CODE_LENGTH = 6;

function normalizeRecoveryCode(value: string) {
  return value.toUpperCase();
}

export default function OTPFieldCustomNormalizeDemo() {
  const id = createUniqueId();
  const descriptionId = `${id}-description`;

  let focusedIndex = signal(0);
  let invalidPulse = signal(0);
  let statusMessage = signal("");
  let invalidTimeout: ReturnType<typeof setTimeout> | undefined;
  let skipClearOnNextValueChange = false;

  onCleanup(() => {
    clearTimeout(invalidTimeout);
  });

  function clearInvalidFeedback() {
    clearTimeout(invalidTimeout);
    invalidTimeout = undefined;
    invalidPulse = 0;
    statusMessage = "";
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
    invalidPulse = invalidPulse + 1;
    statusMessage = `Unsupported characters were ignored from ${value}.`;

    clearTimeout(invalidTimeout);
    invalidTimeout = setTimeout(() => {
      invalidTimeout = undefined;
      invalidPulse = 0;
    }, 400);
  }

  const activeInvalidIndex = computed(invalidPulse > 0 ? focusedIndex : -1);

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
          {(_, index) => (
            <OTPField.Input
              class={[
                "font-inherit m-0 h-10 w-10 rounded-none border bg-white text-center text-base font-normal text-neutral-950 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:border-white dark:bg-neutral-950 dark:text-white dark:focus:outline-white",
                activeInvalidIndex === index
                  ? "border-red-500 outline-2 outline-red-500 dark:border-red-400 dark:outline-red-400"
                  : "border-neutral-950",
              ]}
              aria-label={index === 0 ? undefined : `Character ${index + 1} of ${CODE_LENGTH}`}
              onFocus={() => {
                focusedIndex = index;
              }}
            />
          )}
        </For>
      </OTPField.Root>
      <p id={descriptionId} class="m-0 text-sm text-neutral-600 dark:text-neutral-400">
        Letters and digits only. Letters are converted to uppercase.
      </p>
      <span aria-live="polite" class="sr-only">
        {statusMessage}
      </span>
    </div>
  );
}
