/**
 * Returns the default submitter of the form: the first submit button in tree order.
 * Used to implicitly submit the form when Enter is pressed on a control that
 * handles Enter itself instead of letting the browser submit natively.
 */
export function getDefaultFormSubmitter(form: HTMLFormElement | null): HTMLButtonElement | HTMLInputElement | null {
  if (!form) {
    return null;
  }

  for (const candidate of form.elements) {
    const tagName = candidate.tagName;
    if (tagName === "BUTTON" || tagName === "INPUT") {
      const button = candidate as HTMLButtonElement | HTMLInputElement;
      if (button.type === "submit") {
        return button;
      }
    }
  }

  return null;
}
