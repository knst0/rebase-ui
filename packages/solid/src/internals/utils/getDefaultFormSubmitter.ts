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
