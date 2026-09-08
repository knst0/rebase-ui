import { For, Show, createMemo } from "solid-js";
import { api } from "virtual:api-reference";

import type { ApiPart, ApiProp, ReferenceRow } from "../../plugins";
import { API_SECTION_ID, slugifyWithin } from "../../plugins/shared/text";
import { Heading } from "./Heading";
import { ReferenceTable } from "./ReferenceTable";

function toHtml(description: string | undefined): string {
  return (description ?? "").replace(/\r?\n/g, "<br />");
}

function propRows(props: ApiProp[]): ReferenceRow[] {
  return props.map((prop) => ({
    name: prop.required === true ? `${prop.name}*` : prop.name,
    type: prop.type,
    default: prop.default,
    description: toHtml(prop.description),
  }));
}

function Part(props: { part: ApiPart }) {
  const id = () => slugifyWithin(API_SECTION_ID, props.part.name);

  return (
    <>
      <Heading level={3} id={id()}>
        {props.part.name}
      </Heading>

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

      <ReferenceTable name={props.part.name} rows={propRows(props.part.props)} definitions={props.part.definitions} />

      <Show when={props.part.attributes.length > 0}>
        <ReferenceTable
          name={props.part.name}
          definitions={props.part.definitions}
          rows={props.part.attributes.map((attribute) => ({
            name: attribute.name,
            type: attribute.type,
            description: toHtml(attribute.description),
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
          <Heading level={2} id="api-reference">
            API reference
          </Heading>
          <For each={found().parts}>{(part) => <Part part={part} />}</For>
        </>
      )}
    </Show>
  );
}
