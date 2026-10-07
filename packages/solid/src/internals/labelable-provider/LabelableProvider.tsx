import type { JSX } from "@solidjs/web";
import { createSignal, createUniqueId, untrack } from "solid-js";

import { LabelableContext, useLabelableContext } from "./LabelableContext";

export function LabelableProvider(props: LabelableProvider.Props): JSX.Element {
  const defaultId = createUniqueId();
  const initialControlId = untrack(() => (props.controlId === undefined ? defaultId : props.controlId));

  const [controlId, setControlId] = createSignal<string | null | undefined>(initialControlId, { ownedWrite: true });
  const [labelId, setLabelId] = createSignal<string | undefined>(
    untrack(() => props.labelId),
    { ownedWrite: true },
  );
  const [messageIds, setMessageIds] = createSignal<string[]>([], { ownedWrite: true });

  const registrations = new Map<object, string | null>();

  const parentContext = useLabelableContext();

  const resolveControlId = (prev: string | null | undefined) => {
    // A subtree that keeps its DOM while its scopes are disposed leaves no registrations behind,
    // so preserve the control it had selected instead of dropping the association.
    if (registrations.size === 0) {
      return prev;
    }

    let nextControlId: string | null | undefined;

    for (const id of registrations.values()) {
      // Keep the current selection while it is still registered, so rapid unmount/remount
      // cycles don't churn it.
      if (id === prev) {
        return prev;
      }

      if (nextControlId === undefined) {
        nextControlId = id;
      }
    }

    return nextControlId;
  };

  const registerControlId = (source: object, nextId: string | null | undefined) => {
    if (nextId === undefined) {
      if (!registrations.delete(source)) {
        return;
      }

      if (registrations.size === 0) {
        // The last control unregistered: reset so `for`/`id` don't stick to a removed
        // control. A disposed subtree keeps its rendered association since its scopes
        // are gone and no live reader observes this reset.
        setControlId(defaultId);
        return;
      }

      setControlId(resolveControlId);
      return;
    }

    registrations.set(source, nextId);

    setControlId(resolveControlId);
  };

  // Returns the scope to its generated fallback id so an id-less control that replaces a
  // previously registered one is still associated with the label.
  const resetControlId = () => {
    if (registrations.size === 0) {
      setControlId(defaultId);
    }
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
