import {
  type ComponentProps,
  Dynamic,
  getNextElement,
  isServer,
  type JSX,
  MathMLElements,
  Namespaces,
  spread,
  ssrElement,
  SVGElements,
  type ValidComponent,
} from "@solidjs/web";
import { $PROXY, type Accessor, createMemo, merge, sharedConfig, untrack } from "solid-js";

import { EMPTY_OBJECT } from "#utils";

import { applyStateAttributes, getStateAttributes, type StateAttributesMapping } from "../stateToAttributes";
import type { RebaseUIComponentProps, WithRebaseUIEvent } from "../types";

export function RenderElement<T extends ValidComponent, State extends Record<string, any>, Enabled extends Accessor<boolean> | undefined>(
  props: RenderElementProps<T, State, Enabled>,
): JSX.Element {
  const component = untrack(() => props.as);
  const isDomElement = !isServer && typeof component === "string";

  const create = () => {
    const componentProps = resolveProps<T, State>(props.state, props.props, props.stateAttributesMapping, isDomElement) as Record<
      string,
      any
    >;

    const element = renderComponent(component, componentProps);

    if (isDomElement && props.state !== undefined) {
      applyStateAttributes(element as Element, props.state, props.stateAttributesMapping, componentProps);
    }

    return element;
  };

  if (untrack(() => props.enabled) === undefined) {
    return create();
  }

  const isEnabled = createMemo(() => {
    const enabled = props.enabled;
    return enabled === undefined ? true : enabled();
  });

  const element = createMemo(() => (isEnabled() ? create() : null));

  return element as unknown as JSX.Element;
}

function renderComponent(component: ValidComponent, componentProps: Record<string, any>) {
  if (typeof component !== "string") {
    return <Dynamic {...(componentProps as any)} component={component as ValidComponent} />;
  }

  if (isServer) {
    const children = "children" in componentProps ? componentProps.children : undefined;
    return ssrElement(component, componentProps, children, true) as unknown as Element;
  }

  const element = sharedConfig.hydrating
    ? getNextElement(hydrationTemplate(component, componentProps))
    : createDomElement(
        component,
        untrack(() => componentProps.is),
      );
  spread(element, componentProps, !("children" in componentProps));
  return element;
}

type HydrationTemplate = (() => Element) & { _html?: string };

function hydrationTemplate(component: string, componentProps: Record<string, any>): HydrationTemplate {
  const template: HydrationTemplate = () =>
    createDomElement(
      component,
      untrack(() => componentProps.is),
    );
  template._html = `<${component}`;
  return template;
}

function createDomElement(tagName: string, is: string | undefined) {
  if (SVGElements.has(tagName)) {
    return document.createElementNS(Namespaces.svg, tagName);
  }
  if (MathMLElements.has(tagName)) {
    return document.createElementNS(Namespaces.mathml, tagName);
  }
  return document.createElement(tagName, { is });
}

type PropsSourceList = ReadonlyArray<Record<string, any> | ((props: any) => Record<string, any>) | undefined>;

interface SourceResolution {
  resolveSource: <S extends Record<string, any>>(source: S) => S;
  collectRef: (source: any, replacesEarlierRefs: boolean) => void;
  chainedRef: () => ((element: unknown) => void) | undefined;
}

function resolveProps<T extends ValidComponent, State extends Record<string, Accessor<unknown>>>(
  state: State | undefined,
  props: RenderElementProps<T, State, undefined>["props"],
  stateAttributesMapping: StateAttributesMapping<State> | undefined,
  bindsStateDirectly: boolean,
) {
  const stateValue = state ?? ({} as State);
  const propsValue = props ?? {};
  const propsSources = (Array.isArray(propsValue) ? propsValue : [propsValue]) as PropsSourceList;

  const stateAttributes = bindsStateDirectly ? EMPTY_OBJECT : getStateAttributes(stateValue, stateAttributesMapping);
  const helpers = createSourceResolution(stateValue);

  if (propsSources.some((source) => source !== undefined && typeof source !== "function" && hasDynamicKeys(source))) {
    return mergeSources(stateAttributes, propsSources, helpers) as ComponentProps<T>;
  }

  if (hasDynamicKeys(stateAttributes)) {
    const collapsed = collapseSources(undefined, propsSources, helpers);
    return mergeAll([stateAttributes, collapsed]) as ComponentProps<T>;
  }

  return collapseSources(stateAttributes, propsSources, helpers) as ComponentProps<T>;
}

function createSourceResolution<State>(stateValue: State): SourceResolution {
  let refs = new Set<(element: unknown) => void>();

  const resolveSource = <S extends Record<string, any>>(source: S): S => {
    if (!("class" in source) && !("style" in source) && !("children" in source)) return source;

    const resolvedChildren = "children" in source ? createMemo(() => source.children) : undefined;

    const read = (key: string) => {
      if (key === "class") return resolveClass(source.class, stateValue);
      if (key === "style") return resolveStyle(source.style, stateValue);

      const value = resolvedChildren?.();
      return typeof value === "function" ? (value as (state: State) => JSX.Element)(stateValue) : value;
    };

    const target: Record<string, any> = {};

    for (const key in source) {
      const get = key === "class" || key === "style" || key === "children" ? () => read(key) : () => source[key];
      Object.defineProperty(target, key, { enumerable: true, configurable: true, get });
    }

    return target as S;
  };

  const collectRef = (source: any, replacesEarlierRefs: boolean) => {
    const ref = untrack(() => source?.ref);
    if (typeof ref !== "function") return;
    if (replacesEarlierRefs) refs = new Set();
    refs.add(ref);
  };

  const chainedRef = () => {
    if (refs.size < 2) return undefined;
    const chained = [...refs];
    return (element: unknown) => {
      for (const ref of chained) ref(element);
    };
  };

  return { resolveSource, collectRef, chainedRef };
}

function mergeSources(stateAttributes: Record<string, any>, propsSources: PropsSourceList, helpers: SourceResolution) {
  const { resolveSource, collectRef, chainedRef } = helpers;
  const sources: any[] = [stateAttributes];

  for (const source of propsSources) {
    if (source === undefined) continue;

    if (typeof source === "function") {
      const externalProps = mergeAll(sources);
      const resolved = createMemo(() => resolveSource(source(externalProps)));
      const flattened = flatten(resolved);
      sources.push(flattened);
      collectRef(flattened, true);
      continue;
    }

    const resolvedSource = resolveSource(source);
    sources.push(resolvedSource);
    collectRef(resolvedSource, false);
  }

  const ref = chainedRef();
  if (ref !== undefined) sources.push({ ref });

  return mergeAll(sources);
}

function collapseSources(stateAttributes: Record<string, any> | undefined, propsSources: PropsSourceList, helpers: SourceResolution) {
  const { resolveSource, collectRef, chainedRef } = helpers;
  const descriptors = new Map<string, PropertyDescriptor>();
  let passthrough: Record<string, any> | undefined;

  const materialize = () => {
    const target: Record<string, any> = {};
    for (const [key, descriptor] of descriptors) Object.defineProperty(target, key, descriptor);
    return target;
  };

  const define = (key: string, descriptor: PropertyDescriptor) => {
    if (key === "__proto__" || key === "constructor") return;
    descriptors.set(key, descriptor);
  };

  const absorb = (source: Record<string, any>) => {
    passthrough = descriptors.size === 0 ? source : undefined;
    for (const key of Object.keys(source)) define(key, Object.getOwnPropertyDescriptor(source, key)!);
  };

  if (stateAttributes !== undefined) absorb(stateAttributes);

  for (const source of propsSources) {
    if (source === undefined) continue;

    if (typeof source === "function") {
      const externalProps = materialize();
      const resolved = createMemo(() => resolveSource(source(externalProps)));
      const snapshot = untrack(resolved);

      passthrough = undefined;
      for (const key of Object.keys(snapshot)) {
        define(key, { enumerable: true, configurable: true, get: () => resolved()[key] });
      }

      collectRef(snapshot, true);
      continue;
    }

    const resolvedSource = resolveSource(source);
    absorb(resolvedSource);
    collectRef(resolvedSource, false);
  }

  const ref = chainedRef();
  if (ref !== undefined) {
    passthrough = undefined;
    define("ref", { enumerable: true, configurable: true, value: ref });
  }

  return passthrough ?? materialize();
}

function hasDynamicKeys(source: Record<string, any>) {
  return $PROXY in source;
}

function flatten(resolved: () => Record<string, any>) {
  const source = untrack(resolved);
  const target: Record<string, any> = {};

  for (const key of Object.keys(source)) {
    Object.defineProperty(target, key, { enumerable: true, configurable: true, get: () => resolved()[key] });
  }

  return target;
}

function resolveStyle<State>(value: unknown, state: State): unknown {
  if (typeof value === "function") {
    return (value as (state: State) => unknown)(state);
  }
  return value;
}

function resolveClass<State>(value: unknown, state: State): unknown {
  if (typeof value === "function") {
    return resolveClass((value as (state: State) => unknown)(state), state);
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveClass(item, state));
  }
  return value;
}

function mergeAll(sources: any[]) {
  if (sources.length === 1 && typeof sources[0] !== "function") return sources[0];
  return merge(...sources);
}

type PropsSource<T extends ValidComponent, State> = Omit<WithRebaseUIEvent<Partial<ComponentProps<T>>>, "children" | "class" | "style"> &
  Pick<RebaseUIComponentProps<T, State>, "children" | "class" | "style">;

export interface RenderElementProps<T extends ValidComponent, State, Enabled extends boolean | Accessor<boolean> | undefined> {
  /**
   * The element or component to render.
   */
  as: T;
  /**
   * If `false`, the hook will skip most of its internal logic and return `null`.
   * This is useful for rendering a component conditionally.
   * @default true
   */
  enabled?: Enabled;
  /**
   * The state of the component.
   */
  state?: State | undefined;
  /**
   * Intrinsic props to be spread on the rendered element.
   */
  props?:
    | PropsSource<T, State>
    | Array<PropsSource<T, State> | ((props: PropsSource<T, State>) => PropsSource<T, State>) | undefined>
    | undefined;
  /**
   * A mapping of state to `data-*` attributes.
   */
  stateAttributesMapping?: StateAttributesMapping<State> | undefined;
}
