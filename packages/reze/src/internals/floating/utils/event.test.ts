import { afterEach, describe, expect, it } from "vite-plus/test";

import { isVirtualPointerEvent } from "./event";

const DESKTOP_USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const ANDROID_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";

// The predicate short-circuits under DOM emulation (HappyDOM here), so pin the
// shape checks with a desktop user agent. The Reze port reads `navigator` on
// every call, so each case stubs it directly.
function stubUserAgent(value: string) {
  Object.defineProperty(window.navigator, "userAgent", { value, configurable: true });
}

afterEach(() => {
  delete (window.navigator as unknown as Record<string, unknown>).userAgent;
});

function pointerEvent(overrides: Partial<PointerEvent>): PointerEvent {
  return {
    type: "pointerdown",
    width: 1,
    height: 1,
    pressure: 0,
    detail: 0,
    buttons: 0,
    pointerType: "mouse",
    ...overrides,
  } as PointerEvent;
}

describe("isVirtualPointerEvent", () => {
  it("recognizes a pressureless 1x1 mouse pointerdown as a screen reader press", () => {
    stubUserAgent(DESKTOP_USER_AGENT);
    expect(isVirtualPointerEvent(pointerEvent({}))).toBe(true);
  });

  it("ignores a pressed mouse", () => {
    stubUserAgent(DESKTOP_USER_AGENT);
    expect(isVirtualPointerEvent(pointerEvent({ pressure: 0.5 }))).toBe(false);
    expect(isVirtualPointerEvent(pointerEvent({ pressure: 0, buttons: 1 }))).toBe(false);
  });

  it("recognizes a TalkBack press with a pressed button on Android", () => {
    stubUserAgent(ANDROID_USER_AGENT);
    expect(isVirtualPointerEvent(pointerEvent({ buttons: 1 }))).toBe(true);
    expect(isVirtualPointerEvent(pointerEvent({ buttons: 1, pressure: 0.5 }))).toBe(false);
  });

  it("ignores the same shape on other pointer types", () => {
    stubUserAgent(DESKTOP_USER_AGENT);
    expect(isVirtualPointerEvent(pointerEvent({ pointerType: "touch" }))).toBe(false);
    expect(isVirtualPointerEvent(pointerEvent({ pointerType: "pen" }))).toBe(false);
  });

  it("ignores the same shape on events other than pointerdown", () => {
    stubUserAgent(DESKTOP_USER_AGENT);
    expect(isVirtualPointerEvent(pointerEvent({ type: "pointerup" }))).toBe(false);
    expect(isVirtualPointerEvent(pointerEvent({ type: "pointermove" }))).toBe(false);
  });

  it("recognizes an iOS VoiceOver touch", () => {
    stubUserAgent(DESKTOP_USER_AGENT);
    expect(isVirtualPointerEvent(pointerEvent({ pointerType: "touch", width: 0.333, height: 0.333 }))).toBe(true);
  });

  it("short-circuits under DOM emulation", () => {
    expect(isVirtualPointerEvent(pointerEvent({}))).toBe(false);
  });
});
