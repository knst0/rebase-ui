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

function resolveProps<T extends ValidComponent, State extends Record<string, Accessor<unknown>>>(
  state: State | undefined,
  props: RenderElementProps<T, State, undefined>["props"],
  stateAttributesMapping: StateAttributesMapping<State> | undefined,
  bindsStateDirectly: boolean,
) {
  const stateValue = state ?? ({} as State);
  const propsValue = props ?? {};
  const propsSources = (Array.isArray(propsValue) ? propsValue : [propsValue]) as PropsSourceList;

  const resolveSource = createSourceResolver(stateValue);
  const refs = createRefChain();
  const layers: Record<string, any>[] = [];

  if (!bindsStateDirectly) {
    const stateAttributes = getStateAttributes(stateValue, stateAttributesMapping);
    if (Object.keys(stateAttributes).length > 0) {
      layers.push(stateAttributes);
    }
  }

  for (const source of propsSources) {
    if (source === undefined) {
      continue;
    }

    if (typeof source === "function") {
      const externalProps = combineLayers(layers.slice());
      const resolved = createMemo(() => resolveSource(source(externalProps)));
      const layer = reactiveLayer(resolved);

      layers.push(layer);
      refs.replaceWith(layer);
      continue;
    }

    const layer = resolveSource(source);
    layers.push(layer);
    refs.add(layer);
  }

  const chainedRef = refs.chained();
  if (chainedRef !== undefined) {
    layers.push({ ref: chainedRef });
  }

  return combineLayers(layers) as ComponentProps<T>;
}

function combineLayers(layers: Record<string, any>[]): Record<string, any> {
  if (layers.length === 0) {
    return {};
  }
  if (layers.some(hasDynamicKeys)) {
    return layers.length === 1 ? layers[0] : merge(...layers);
  }

  // Object styles merge per-property (later layers win) instead of replacing
  // each other wholesale, so internal positioning styles survive user styles.
  const mergeStyles = shouldMergeLayerStyles(layers);

  const target: Record<string, any> = {};

  for (const layer of layers) {
    for (const key of Object.keys(layer)) {
      if (key === "__proto__" || key === "constructor") {
        continue;
      }
      if (key === "style" && mergeStyles) {
        continue;
      }
      Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(layer, key)!);
    }
  }

  if (mergeStyles) {
    defineMergedStyle(target, layers);
  }

  return target;
}

function shouldMergeLayerStyles(layers: Record<string, any>[]): boolean {
  let foundObjectStyle = false;

  for (const layer of layers) {
    // Read without subscribing; the merged getter below subscribes on use.
    const style = untrack(() => layer.style);

    if (style == null) {
      continue;
    }

    if (typeof style !== "object") {
      // A string style cannot merge per-property; keep last-wins behavior.
      return false;
    }

    foundObjectStyle = true;
  }

  return foundObjectStyle;
}

function defineMergedStyle(target: Record<string, any>, layers: Record<string, any>[]): void {
  Object.defineProperty(target, "style", {
    enumerable: true,
    configurable: true,
    get: () => {
      // Re-read every layer on each access so signal reads inside style
      // getters are tracked by the consumer (e.g. `spread`'s compute), and
      // the fresh object identity notifies it when they change. Without this,
      // the memoized layer style keeps a stable reference and updates made
      // after mount never reach the DOM.
      const merged: Record<string, unknown> = {};

      for (const layer of layers) {
        const style: unknown = layer.style;

        if (typeof style !== "object" || style === null) {
          continue;
        }

        const source = style as Record<string, unknown>;
        for (const key of Object.keys(source)) {
          if (key === "__proto__") {
            continue;
          }
          merged[key] = source[key];
        }
      }

      return merged;
    },
  });
}

function reactiveLayer(resolved: () => Record<string, any>) {
  const snapshot = untrack(resolved);
  const layer: Record<string, any> = {};

  for (const key of Object.keys(snapshot)) {
    Object.defineProperty(layer, key, { enumerable: true, configurable: true, get: () => resolved()[key] });
  }

  return layer;
}

function createSourceResolver<State>(stateValue: State) {
  return <S extends Record<string, any>>(source: S): S => {
    if (!("class" in source) && !("style" in source) && !("children" in source)) {
      return source;
    }

    const resolvedClass = "class" in source ? createMemo(() => resolveClass(source.class, stateValue)) : undefined;
    const resolvedStyle = "style" in source ? createMemo(() => resolveStyle(source.style, stateValue)) : undefined;
    const resolvedChildren = "children" in source ? createMemo(() => resolveChildren(source.children, stateValue)) : undefined;

    const read = (key: string) => {
      if (key === "class") return resolvedClass?.();
      if (key === "style") return resolvedStyle?.();
      return resolvedChildren?.();
    };

    const target: Record<string, any> = {};

    for (const key in source) {
      const get = key === "class" || key === "style" || key === "children" ? () => read(key) : () => source[key];
      Object.defineProperty(target, key, { enumerable: true, configurable: true, get });
    }

    return target as S;
  };
}

function createRefChain() {
  let refs = new Set<(element: unknown) => void>();

  const readRef = (layer: Record<string, any>) => {
    const ref = untrack(() => layer?.ref);
    return typeof ref === "function" ? (ref as (element: unknown) => void) : undefined;
  };

  return {
    add(layer: Record<string, any>) {
      const ref = readRef(layer);
      if (ref !== undefined) refs.add(ref);
    },
    replaceWith(layer: Record<string, any>) {
      const ref = readRef(layer);
      if (ref === undefined) return;
      refs = new Set([ref]);
    },
    chained() {
      if (refs.size < 2) return undefined;
      const chained = [...refs];
      return (element: unknown) => {
        for (const ref of chained) ref(element);
      };
    },
  };
}

function hasDynamicKeys(source: Record<string, any>) {
  return $PROXY in source;
}

function resolveStyle<State>(value: unknown, state: State): unknown {
  if (typeof value === "function") {
    return (value as (state: State) => unknown)(state);
  }
  return value;
}

function resolveChildren<State>(value: unknown, state: State): unknown {
  if (typeof value === "function") {
    return (value as (state: State) => JSX.Element)(state);
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
