import { tick } from "@rezejs/testing-library";

export const nextFrames = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        tick();
        resolve();
      });
    });
  });
