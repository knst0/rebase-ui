import { Form } from "@rebase-ui/solid/form";

import { expectType } from "#test-utils";

interface Values {
  name: string;
  age: number;
}

<Form<Values>
  onFormSubmit={(values) => {
    expectType<string, typeof values.name>(values.name);
    expectType<number, typeof values.age>(values.age);
    // @ts-expect-error
    values.email.startsWith("a");
  }}
/>;
