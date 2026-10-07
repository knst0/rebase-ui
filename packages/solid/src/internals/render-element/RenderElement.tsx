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
    const componentProps = resolveProps<T, State>(
      props.state,
      props.props,
      props.stateAttributesMapping,
      isDomElement,
      untrack(() => props.untrackChildren) ?? false,
    ) as Record<string, any>;

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
  spread(
    element,
    componentProps,
    untrack(() => !("children" in componentProps)),
  );
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

const DYNAMIC_LAYER = Symbol("rebase-ui:dynamic-layer");

/**
 * A props source whose key set can change over time: a layer may gain or drop
 * keys after mount (e.g. props a store publishes from an effect), so a frozen
 * snapshot of its keys would silently drop them.
 *
 * `keys`/`has` track a key *signature* rather than the layer value, so probing
 * for a key subscribes the reader to key-set changes only. Values stay behind
 * `read`, keeping a consumer that reads one key out of unrelated layers'
 * dependency sets.
 */
interface DynamicLayer {
  [DYNAMIC_LAYER]: true;
  read: () => Record<string, any>;
  keys: () => readonly string[];
  has: (key: string) => boolean;
}

type Layer = Record<string, any> | DynamicLayer;

const KEY_SEPARATOR = "\u0000";

function createDynamicLayer(read: () => Record<string, any>): DynamicLayer {
  const signature = createMemo(() => Object.keys(read()).join(KEY_SEPARATOR));
  const keys = createMemo(() => {
    const current = signature();
    return current === "" ? (EMPTY_KEYS as readonly string[]) : current.split(KEY_SEPARATOR);
  });
  const keySet = createMemo(() => new Set(keys()));

  return { [DYNAMIC_LAYER]: true, read, keys, has: (key) => keySet().has(key) };
}

const EMPTY_KEYS: readonly string[] = [];

function isDynamicLayer(layer: Layer): layer is DynamicLayer {
  return DYNAMIC_LAYER in layer;
}

function layerHas(layer: Layer, key: string): boolean {
  return isDynamicLayer(layer) ? layer.has(key) : key in layer;
}

function layerGet(layer: Layer, key: string): unknown {
  return isDynamicLayer(layer) ? layer.read()[key] : layer[key];
}

function layerKeys(layer: Layer): readonly string[] {
  return isDynamicLayer(layer) ? layer.keys() : Object.keys(layer);
}

function resolveProps<T extends ValidComponent, State extends Record<string, Accessor<unknown>>>(
  state: State | undefined,
  props: RenderElementProps<T, State, undefined>["props"],
  stateAttributesMapping: StateAttributesMapping<State> | undefined,
  bindsStateDirectly: boolean,
  untrackChildren: boolean,
) {
  const stateValue = state ?? ({} as State);
  const propsValue = props ?? {};
  const propsSources = (Array.isArray(propsValue) ? propsValue : [propsValue]) as PropsSourceList;

  const resolveSource = createSourceResolver(stateValue, untrackChildren);
  const refs = createRefChain();
  const layers: Layer[] = [];

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

      layers.push(createDynamicLayer(resolved));
      refs.replaceWith(resolved);
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

function combineLayers(layers: Layer[]): Record<string, any> {
  if (layers.length === 0) {
    return {};
  }
  if (layers.some(isDynamicLayer)) {
    return createDynamicProps(layers);
  }

  const staticLayers = layers as Record<string, any>[];
  if (staticLayers.some(hasDynamicKeys)) {
    return staticLayers.length === 1 ? staticLayers[0] : merge(...staticLayers);
  }

  // Object styles merge per-property (later layers win) instead of replacing
  // each other wholesale, so internal positioning styles survive user styles.
  const mergeStyles = shouldMergeLayerStyles(staticLayers);

  const target: Record<string, any> = {};

  for (const layer of staticLayers) {
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
    defineMergedStyle(target, staticLayers);
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

/**
 * Combines layers whose key sets can change over time. Key probes track each
 * dynamic layer's key signature, and value reads track only the layer that
 * owns the key, so a consumer reading one prop does not subscribe to every
 * layer's value.
 */
function createDynamicProps(layers: Layer[]): Record<string, any> {
  const readStyle = () => {
    const styles: unknown[] = [];

    for (const layer of layers) {
      if (!layerHas(layer, "style")) {
        continue;
      }
      const style = layerGet(layer, "style");
      if (style != null) {
        styles.push(style);
      }
    }

    if (styles.length === 0) {
      return undefined;
    }
    // A string style cannot merge per-property; keep last-wins behavior.
    if (styles.some((style) => typeof style !== "object")) {
      return styles[styles.length - 1];
    }

    const merged: Record<string, unknown> = {};
    for (const style of styles as Record<string, unknown>[]) {
      for (const key of Object.keys(style)) {
        if (key === "__proto__") {
          continue;
        }
        merged[key] = style[key];
      }
    }
    return merged;
  };

  const read = (key: string) => {
    // Object styles merge per-property (later layers win) instead of replacing
    // each other wholesale, so internal positioning styles survive user styles.
    if (key === "style") {
      return readStyle();
    }
    for (let index = layers.length - 1; index >= 0; index -= 1) {
      if (layerHas(layers[index], key)) {
        return layerGet(layers[index], key);
      }
    }
    return undefined;
  };

  const hasKey = (key: PropertyKey) => {
    if (typeof key !== "string") {
      return false;
    }
    for (const layer of layers) {
      if (layerHas(layer, key)) {
        return true;
      }
    }
    return false;
  };

  const proxy: Record<string, any> = new Proxy({} as Record<string, any>, {
    get(_target, key) {
      // `$PROXY` self-identification makes Solid read own keys reflectively and
      // lets `merge` treat this object as a reactive source.
      if (key === $PROXY) {
        return proxy;
      }
      return typeof key === "string" ? read(key) : undefined;
    },
    has(_target, key) {
      return key === $PROXY || hasKey(key);
    },
    ownKeys() {
      const keys = new Set<string>();
      for (const layer of layers) {
        for (const key of layerKeys(layer)) {
          if (key === "__proto__" || key === "constructor") {
            continue;
          }
          keys.add(key);
        }
      }
      return [...keys];
    },
    getOwnPropertyDescriptor(_target, key) {
      if (!hasKey(key)) {
        return undefined;
      }
      // The proxy target lacks the property, so the descriptor must be
      // configurable to satisfy proxy invariants.
      return { enumerable: true, configurable: true, get: () => read(key as string) };
    },
    set() {
      return true;
    },
    deleteProperty() {
      return true;
    },
  });

  return proxy;
}

function createSourceResolver<State>(stateValue: State, untrackChildren: boolean) {
  return <S extends Record<string, any>>(source: S): S => {
    if (!("class" in source) && !("style" in source) && !("children" in source)) {
      return source;
    }

    const resolvedClass = "class" in source ? createMemo(() => resolveClass(source.class, stateValue)) : undefined;
    const resolvedStyle = "style" in source ? createMemo(() => resolveStyle(source.style, stateValue)) : undefined;
    // Create structural children once, but keep a returned accessor tracked:
    // providers and conditional portals return accessors whose DOM markers
    // must continue updating without recreating the child component.
    const resolvedChildren =
      "children" in source
        ? untrackChildren
          ? (() => {
              const childrenValue = untrack(() => source.children);
              return createMemo(() => resolveChildren(childrenValue, stateValue));
            })()
          : createMemo(() => resolveChildren(source.children, stateValue))
        : undefined;

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

  const readRef = (layer: Record<string, any> | (() => Record<string, any>)) => {
    const ref = untrack(() => (typeof layer === "function" ? layer() : layer)?.ref);
    return typeof ref === "function" ? (ref as (element: unknown) => void) : undefined;
  };

  return {
    add(layer: Record<string, any>) {
      const ref = readRef(layer);
      if (ref !== undefined) refs.add(ref);
    },
    replaceWith(layer: () => Record<string, any>) {
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
  /**
   * Read structural `children` once without tracking their creation. Returned
   * accessors remain tracked so providers and conditional portals update their
   * DOM without recreating stateful child components. Defaults to `false` so
   * parts whose content reacts to state (e.g. filtered lists) re-read children.
   * @default false
   */
  untrackChildren?: boolean | undefined;
}
