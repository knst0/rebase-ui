import { Field } from "@rebase-ui/solid/field";
import { createSignal } from "solid-js";

function App() {
  const [_element, setElement] = createSignal<HTMLTextAreaElement | null>(null);
  return <Field.Control ref={setElement} as="textarea" />;
}
