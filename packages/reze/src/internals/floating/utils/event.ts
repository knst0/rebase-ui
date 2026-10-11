// Local subset of `internals/utils/platform` (not yet ported to Reze): the only
// two flags the floating event predicates need. Unlike the shared module, these
// read `navigator` on every call instead of once at module load, so tests can
// stub the user agent per case. Replace with the shared import once it lands.

function readUserAgent(): string {
  if (typeof navigator === "undefined") {
    return "";
  }
  return navigator.userAgent ?? "";
}

function readPlatformName(): string {
  if (typeof navigator === "undefined") {
    return "";
  }
  return (navigator as Navigator & { platform?: string | undefined }).platform ?? "";
}

function isAndroidOs(): boolean {
  return readPlatformName().toLowerCase() === "android" || readUserAgent().toLowerCase().includes("android");
}

function isDomEmulation(): boolean {
  return /jsdom|happydom/.test(readUserAgent().toLowerCase());
}

export function stopEvent(event: Event | { preventDefault(): void; stopPropagation(): void }) {
  event.preventDefault();
  event.stopPropagation();
}

// License: https://github.com/adobe/react-spectrum/blob/main/packages/@react-aria/utils/src/isVirtualEvent.ts
export function isVirtualClick(event: MouseEvent | PointerEvent): boolean {
  if ((event as PointerEvent).pointerType === "" && event.isTrusted) {
    return true;
  }

  if (isAndroidOs() && (event as PointerEvent).pointerType) {
    return event.type === "click" && event.buttons === 1;
  }

  return event.detail === 0 && !(event as PointerEvent).pointerType;
}

export function isVirtualPointerEvent(event: PointerEvent) {
  if (isDomEmulation()) {
    return false;
  }
  const android = isAndroidOs();
  return (
    (!android && event.width === 0 && event.height === 0) ||
    // Chrome synthesizes a screen reader press (TalkBack, VoiceOver, NVDA) as a 1x1 mouse
    // `pointerdown` with no pressure. TalkBack can report a pressed button, while desktop
    // mouse presses can report no pressure, so only require no pressed button off Android.
    (event.type === "pointerdown" &&
      event.width === 1 &&
      event.height === 1 &&
      event.pressure === 0 &&
      event.detail === 0 &&
      event.pointerType === "mouse" &&
      (android || event.buttons === 0)) ||
    // iOS VoiceOver returns 0.333• for width/height.
    (event.width < 1 && event.height < 1 && event.pressure === 0 && event.detail === 0 && event.pointerType === "touch")
  );
}

export function isMouseLikePointerType(pointerType: string | undefined, strict?: boolean) {
  // On some Linux machines with Chromium, mouse inputs return a `pointerType`
  // of "pen": https://github.com/floating-ui/floating-ui/issues/2015
  const values: Array<string | undefined> = ["mouse", "pen"];
  if (!strict) {
    values.push("", undefined);
  }
  return values.includes(pointerType);
}

export function isTouchLikePointerType(pointerType: string | undefined) {
  return pointerType === "touch" || pointerType === "pen";
}

export function isClickLikeEvent(event: Event) {
  const type = event.type;
  return type === "click" || type === "mousedown" || type === "keydown" || type === "keyup";
}
