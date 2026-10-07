// Framework-free port of `@base-ui/utils/platform` detections used here.
// The upstream package derives these flags from `navigator` once at load and
// stays SSR-safe by evaluating to `false` when `navigator` is undefined.
function getLowerUserAgent() {
  return typeof navigator === "undefined" ? "" : (navigator.userAgent ?? "").toLowerCase();
}

function getLowerPlatform() {
  return typeof navigator === "undefined" ? "" : ((navigator as Navigator).platform ?? "").toLowerCase();
}

function isJSDOM() {
  return /jsdom|happydom/.test(getLowerUserAgent());
}

function isAndroid() {
  const platform = getLowerPlatform();
  const userAgent = getLowerUserAgent();
  return platform === "android" || userAgent.includes("android");
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

  if (isAndroid() && (event as PointerEvent).pointerType) {
    return event.type === "click" && event.buttons === 1;
  }

  return event.detail === 0 && !(event as PointerEvent).pointerType;
}

export function isVirtualPointerEvent(event: PointerEvent) {
  if (isJSDOM()) {
    return false;
  }
  return (
    (!isAndroid() && event.width === 0 && event.height === 0) ||
    (isAndroid() &&
      event.width === 1 &&
      event.height === 1 &&
      event.pressure === 0 &&
      event.detail === 0 &&
      event.pointerType === "mouse") ||
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

export function isClickLikeEvent(event: Event) {
  const type = event.type;
  return type === "click" || type === "mousedown" || type === "keydown" || type === "keyup";
}
