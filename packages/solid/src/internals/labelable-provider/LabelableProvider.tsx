import type { JSX } from "@solidjs/web";
import { createSignal, createUniqueId, untrack } from "solid-js";

import { LabelableContext, useLabelableContext } from "./LabelableContext";

export function LabelableProvider(props: LabelableProvider.Props): JSX.Element {
  const defaultId = createUniqueId();
  const initialControlId = untrack(() => (props.controlId === undefined ? defaultId : props.controlId));

  const [controlId, setControlId] = createSignal<string | null | undefined>(initialControlId);
  const [labelId, setLabelId] = createSignal<string | undefined>(untrack(() => props.labelId));
  const [messageIds, setMessageIds] = createSignal<string[]>([]);

  const registrations = new Map<symbol, string | null>();

  const parentContext = useLabelableContext();

  const resolveControlId = (prev: string | null | undefined) => {
    if (registrations.size === 0) {
      return undefined;
    }

    let nextControlId: string | null | undefined;

    for (const id of registrations.values()) {
      if (prev !== undefined && id === prev) {
        return prev;
      }

      if (nextControlId === undefined) {
        nextControlId = id;
      }
    }

    return nextControlId;
  };

  const registerControlId = (source: symbol, nextId: string | null | undefined) => {
    if (nextId === undefined) {
      if (registrations.delete(source)) {
        setControlId(resolveControlId);
      }
      return;
    }

    registrations.set(source, nextId);

    setControlId(resolveControlId);
  };

  const resetControlId = () => {
    registrations.clear();
    setControlId(undefined);
  };

  const getDescriptionProps = (externalProps: Record<string, any>): Record<string, any> => {
    const target: Record<string, any> = {};
    for (const key in externalProps) {
      if (key === "aria-describedby") {
        continue;
      }
      Object.defineProperty(target, key, { enumerable: true, configurable: true, get: () => externalProps[key] });
    }

    Object.defineProperty(target, "aria-describedby", {
      enumerable: true,
      configurable: true,
      get: () => {
        const describedBy = externalProps["aria-describedby"];
        const ids = typeof describedBy === "string" && describedBy ? describedBy.split(" ") : [];
        ids.push(...parentContext.messageIds(), ...messageIds());
        return Array.from(new Set(ids)).join(" ") || undefined;
      },
    });

    return target;
  };

  const contextValue: LabelableContext = {
    controlId,
    registerControlId,
    resetControlId,
    labelId,
    setLabelId,
    messageIds,
    setMessageIds,
    getDescriptionProps,
  };

  return <LabelableContext value={contextValue}>{props.children}</LabelableContext>;
}

export interface LabelableProviderProps {
  controlId?: string | null | undefined;
  labelId?: string | undefined;
  children?: JSX.Element;
}

export namespace LabelableProvider {
  export type Props = LabelableProviderProps;
}
