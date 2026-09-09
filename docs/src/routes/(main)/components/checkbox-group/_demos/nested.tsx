import { Checkbox } from "@rebase-ui/solid/checkbox";
import { CheckboxGroup } from "@rebase-ui/solid/checkbox-group";
import type { ComponentProps } from "@solidjs/web";
import { createSignal, createUniqueId, For, Show } from "solid-js";

const mainPermissions = [
  { value: "view-dashboard", label: "View Dashboard" },
  { value: "access-reports", label: "Access Reports" },
];

const userManagementPermissions = [
  { value: "create-user", label: "Create User" },
  { value: "edit-user", label: "Edit User" },
  { value: "delete-user", label: "Delete User" },
  { value: "assign-roles", label: "Assign Roles" },
];

const allMainValues = [...mainPermissions.map((permission) => permission.value), "manage-users"];
const allManagementValues = userManagementPermissions.map((permission) => permission.value);

const checkboxClass =
  "flex size-4 shrink-0 items-center justify-center rounded-none border border-neutral-950 bg-white p-0 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 data-checked:bg-neutral-950 data-checked:text-white data-indeterminate:bg-neutral-950 data-indeterminate:text-white dark:border-white dark:bg-neutral-950 dark:text-neutral-950 dark:focus-visible:outline-white dark:data-checked:bg-white dark:data-checked:text-neutral-950 dark:data-indeterminate:bg-white dark:data-indeterminate:text-neutral-950";

const itemClass = "flex items-center gap-2 text-sm font-normal text-neutral-950 dark:text-white";

export default function ExampleNestedParentCheckbox() {
  const id = createUniqueId();
  const managementId = createUniqueId();

  const [mainValue, setMainValue] = createSignal<string[]>([]);
  const [managementValue, setManagementValue] = createSignal<string[]>([]);

  return (
    <CheckboxGroup
      aria-labelledby={id}
      value={mainValue()}
      onValueChange={(value) => {
        if (value.includes("manage-users")) {
          setManagementValue(allManagementValues);
        } else if (managementValue().length === allManagementValues.length) {
          setManagementValue([]);
        }
        setMainValue(value);
      }}
      allValues={allMainValues}
      class="ml-4 flex flex-col items-start gap-1"
    >
      <label class={`${itemClass} -ml-4`} id={id}>
        <Checkbox.Root
          parent
          indeterminate={managementValue().length > 0 && managementValue().length !== allManagementValues.length}
          class={checkboxClass}
        >
          <Checkbox.Indicator class="flex data-unchecked:hidden">
            {(state) => (
              <Show when={state.indeterminate()} fallback={<CheckIcon />}>
                <HorizontalRuleIcon />
              </Show>
            )}
          </Checkbox.Indicator>
        </Checkbox.Root>
        User Permissions
      </label>

      <For each={mainPermissions}>
        {(permission) => (
          <label class={itemClass}>
            <Checkbox.Root value={permission.value} class={checkboxClass}>
              <Checkbox.Indicator class="flex data-unchecked:hidden">
                <CheckIcon />
              </Checkbox.Indicator>
            </Checkbox.Root>
            {permission.label}
          </label>
        )}
      </For>

      <CheckboxGroup
        aria-labelledby={managementId}
        value={managementValue()}
        onValueChange={(value) => {
          if (value.length === allManagementValues.length) {
            setMainValue((previous) => Array.from(new Set([...previous, "manage-users"])));
          } else {
            setMainValue((previous) => previous.filter((item) => item !== "manage-users"));
          }
          setManagementValue(value);
        }}
        allValues={allManagementValues}
        class="ml-4 flex flex-col items-start gap-1"
      >
        <label class={`${itemClass} -ml-4`} id={managementId}>
          <Checkbox.Root parent class={checkboxClass}>
            <Checkbox.Indicator class="flex data-unchecked:hidden">
              {(state) => (
                <Show when={state.indeterminate()} fallback={<CheckIcon />}>
                  <HorizontalRuleIcon />
                </Show>
              )}
            </Checkbox.Indicator>
          </Checkbox.Root>
          Manage Users
        </label>

        <For each={userManagementPermissions}>
          {(permission) => (
            <label class={itemClass}>
              <Checkbox.Root value={permission.value} class={checkboxClass}>
                <Checkbox.Indicator class="flex data-unchecked:hidden">
                  <CheckIcon />
                </Checkbox.Indicator>
              </Checkbox.Root>
              {permission.label}
            </label>
          )}
        </For>
      </CheckboxGroup>
    </CheckboxGroup>
  );
}

function CheckIcon(props: ComponentProps<"svg">) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" style={{ display: "block" }} {...props}>
      <path d="m2.5 8.5 4 4 7-9" />
    </svg>
  );
}

function HorizontalRuleIcon(props: ComponentProps<"svg">) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke-width={1} style={{ display: "block" }} {...props}>
      <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" vector-effect="non-scaling-stroke" />
    </svg>
  );
}
