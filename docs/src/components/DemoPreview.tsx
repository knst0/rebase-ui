import { Dynamic, type JSX } from "@solidjs/web";
import { Loading, Show, createEffect, createMemo, lazy, type Component } from "solid-js";

import type { FrameworkId } from "../framework";

/** Lazily imports a demo module: a Solid component or a Reze component, depending on the framework. */
export type DemoLoader = () => Promise<{ default: unknown }>;

/** Renders a demo of either framework inside the Solid docs shell. */
export function DemoPreview(props: { framework: FrameworkId; load: DemoLoader; fallback?: JSX.Element }) {
  return (
    <Show when={props.framework === "reze"} fallback={<SolidPreview load={props.load} fallback={props.fallback} />}>
      <RezePreview load={props.load} />
    </Show>
  );
}

function SolidPreview(props: { load: DemoLoader; fallback?: JSX.Element }) {
  const component = createMemo(() => lazy(props.load as () => Promise<{ default: Component }>));
  return (
    <Loading fallback={props.fallback}>
      <Dynamic component={component()} />
    </Loading>
  );
}

/** Mounts the Reze demo into a host element with Reze's own renderer; the Solid side only owns the host. */
function RezePreview(props: { load: DemoLoader }) {
  let host: HTMLDivElement | undefined;

  createEffect(
    () => props.load,
    (load) => {
      let dispose: (() => void) | undefined;
      let cancelled = false;
      void Promise.all([load(), import("../reze/mount")]).then(([module, { mountReze }]) => {
        if (cancelled || host === undefined) return;
        dispose = mountReze(module.default as Parameters<typeof mountReze>[0], host);
      });
      return () => {
        cancelled = true;
        dispose?.();
      };
    },
  );

  return <div ref={(element) => (host = element)} class="contents" />;
}
