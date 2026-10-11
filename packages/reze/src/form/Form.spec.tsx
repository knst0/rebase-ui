import { Form } from "./Form";

interface Values {
  name: string;
  age: number;
}

<Form<Values>
  onFormSubmit={(values) => {
    const name: string = values.name;
    const age: number = values.age;
    console.log(name, age);
    // @ts-expect-error - Values has no email
    values.email.startsWith("a");
  }}
/>;
