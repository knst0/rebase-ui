import { For, Show, createMemo } from "solid-js";
import { api } from "virtual:api-reference";

import type { ApiPart, ApiProp } from "../../plugins";
import { ReferenceTable } from "./ReferenceTable";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function toRows(props: ApiProp[]) {
  return props.map((prop) => ({
    name: prop.required === true ? `${prop.name}*` : prop.name,
    type: prop.type,
    default: prop.default,
    description: (prop.description ?? "").replace(/\r?\n/g, "<br />"),
  }));
}

function Part(props: { part: ApiPart }) {
  const heading = () => slugify(props.part.name);

  return (
    <>
      <h3 id={heading()} class="mt-12 mb-3 block font-semibold" style="scroll-margin-top: 32px;">
        <a href={`#${heading()}`} textContent={props.part.name} />
      </h3>

      <Show when={props.part.description}>
        {(description) => <p class="text-fg/70 mb-2 whitespace-pre-line" textContent={description()} />}
      </Show>

      <p class="text-fg/70 mb-4">
        <Show when={props.part.element}>
          {(element) => (
            <>
              Renders a <code class="bg-gray-1 border-gray-6 rounded border px-1 py-0.25 text-sm" textContent={element()} /> element.
            </>
          )}
        </Show>
      </p>

      <ReferenceTable name={props.part.name} rows={toRows(props.part.props)} definitions={props.part.definitions} />

      <Show when={props.part.attributes.length > 0}>
        <ReferenceTable
          name={props.part.name}
          definitions={props.part.definitions}
          rows={props.part.attributes.map((attribute) => ({
            name: attribute.name,
            type: attribute.type,
            description: (attribute.description ?? "").replace(/\r?\n/g, "<br />"),
          }))}
        />
      </Show>
    </>
  );
}

export function ApiReference(props: { slug: string }) {
  const component = createMemo(() => api[props.slug]);

  return (
    <Show when={component()}>
      {(found) => (
        <>
          <h2 id="api-reference" class="mt-12 mb-4 block text-xl font-semibold" style="scroll-margin-top: 32px;">
            <a href="#api-reference">API reference</a>
          </h2>
          <For each={found().parts}>{(part) => <Part part={part} />}</For>
        </>
      )}
    </Show>
  );
}
