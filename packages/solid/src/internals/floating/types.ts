import type {
  AlignedPlacement,
  Alignment,
  ArrowOptions,
  AutoPlacementOptions,
  AutoUpdateOptions,
  Axis,
  Boundary,
  ClientRectObject,
  ComputePositionConfig,
  ComputePositionReturn,
  Coords,
  DetectOverflowOptions,
  Dimensions,
  ElementContext,
  ElementRects,
  Elements,
  FlipOptions,
  FloatingElement,
  HideOptions,
  InlineOptions,
  Length,
  Middleware,
  MiddlewareArguments,
  MiddlewareData,
  MiddlewareReturn,
  MiddlewareState,
  NodeScroll,
  OffsetOptions,
  Padding,
  Placement,
  Platform,
  Rect,
  ReferenceElement,
  RootBoundary,
  ShiftOptions,
  Side,
  SideObject,
  SizeOptions,
  Strategy,
  VirtualElement,
} from "@floating-ui/dom";

import type { RebaseUIChangeEventDetails } from "../event-details/createEventDetails";
import type { ReactiveBoolean } from "../maybeAccessor";
import type { TransitionStatus } from "../transition-status/createTransitionStatus";
import type { FloatingRootStore } from "./tree/FloatingRootStore";
import type { FloatingTreeStore } from "./tree/FloatingTreeStore";

export type {
  AlignedPlacement,
  Alignment,
  ArrowOptions,
  AutoPlacementOptions,
  AutoUpdateOptions,
  Axis,
  Boundary,
  ClientRectObject,
  ComputePositionConfig,
  ComputePositionReturn,
  Coords,
  DetectOverflowOptions,
  Dimensions,
  ElementContext,
  ElementRects,
  Elements,
  FlipOptions,
  FloatingElement,
  HideOptions,
  InlineOptions,
  Length,
  Middleware,
  MiddlewareArguments,
  MiddlewareData,
  MiddlewareReturn,
  MiddlewareState,
  NodeScroll,
  OffsetOptions,
  Padding,
  Placement,
  Platform,
  Rect,
  ReferenceElement,
  RootBoundary,
  ShiftOptions,
  Side,
  SideObject,
  SizeOptions,
  Strategy,
  VirtualElement,
};
export {
  arrow,
  autoPlacement,
  autoUpdate,
  computePosition,
  detectOverflow,
  flip,
  getOverflowAncestors,
  hide,
  inline,
  limitShift,
  offset,
  platform,
  shift,
  size,
} from "@floating-ui/dom";

type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type Delay = number | Partial<{ open: number; close: number }>;

export type NarrowedElement<T> = T extends Element ? T : Element;

/**
 * Structural view of the trigger registry used by floating elements.
 * Satisfied by the popup `PopupTriggerMap` once that group is ported.
 */
export interface TriggerElementsMap {
  add(id: string, element: Element): void;
  delete(id: string): void;
  hasElement(element: Element): boolean;
  entries(): IterableIterator<[string, Element]>;
}

export interface ExtendedRefs {
  reference: { current: ReferenceType | null };
  floating: { current: HTMLElement | null };
  domReference: { current: NarrowedElement<ReferenceType> | null };
  setReference(node: ReferenceType | null): void;
  setFloating(node: HTMLElement | null): void;
  setPositionReference(node: ReferenceType | null): void;
}

export interface ExtendedElements {
  reference: ReferenceType | null;
  floating: HTMLElement | null;
  domReference: NarrowedElement<ReferenceType> | null;
}

export interface FloatingEvents {
  emit<T extends string>(event: T, data?: any): void;
  on(event: string, handler: (data: any) => void): void;
  off(event: string, handler: (data: any) => void): void;
}

export interface ContextData {
  openEvent?: Event | undefined;
  floatingContext?: FloatingContext | undefined;
  [key: string]: any;
}

/**
 * Structural view of the floating root store, mirroring its constructor
 * options and readable state. Replaced by the real `FloatingRootStore` type
 * once the components group is ported.
 */
export interface FloatingRootContext {
  open: boolean;
  transitionStatus: TransitionStatus | undefined;
  floatingElement: HTMLElement | null;
  referenceElement: ReferenceType | null;
  triggerElements: TriggerElementsMap;
  floatingId: string | undefined;
  syncOnly: boolean;
  nested: boolean;
  onOpenChange: ((open: boolean, eventDetails: RebaseUIChangeEventDetails<string>) => void) | undefined;
}

/**
 * Positioning result fields shared by the floating context, mirroring the
 * framework-facing `useFloating` return value without framework refs.
 */
export interface FloatingPosition {
  x: number;
  y: number;
  placement: Placement;
  strategy: Strategy;
  middlewareData: MiddlewareData;
  isPositioned: boolean;
  update: () => void;
  floatingStyles: {
    position: Strategy;
    top: number;
    left: number;
  };
}

export type FloatingContext = FloatingPosition & {
  open: boolean;
  onOpenChange(open: boolean, eventDetails: RebaseUIChangeEventDetails<string>): void;
  events: FloatingEvents;
  dataRef: { current: ContextData };
  nodeId: string | undefined;
  floatingId: string | undefined;
  refs: ExtendedRefs;
  elements: ExtendedElements;
  rootStore: FloatingRootStore;
};

export interface FloatingNodeType {
  id: string | undefined;
  parentId: string | null;
  context?: FloatingContext | undefined;
}

/**
 * Structural view of the floating tree store. Replaced by the real
 * `FloatingTreeStore` type once the components group is ported.
 */
export interface FloatingTreeType {
  readonly nodesRef: { current: Array<FloatingNodeType> };
}

/**
 * Framework-free element props getters shape. Refined with concrete handler
 * types once the hooks group is ported.
 */
export interface ElementProps {
  reference?: Record<string, unknown> | undefined;
  floating?: Record<string, unknown> | undefined;
  item?: Record<string, unknown> | undefined;
  trigger?: Record<string, unknown> | undefined;
}

export type ReferenceType = Element | VirtualElement;

export interface FloatingUIOpenChangeDetails {
  open: boolean;
  reason: string;
  nativeEvent: Event;
  nested: boolean;
  triggerElement?: Element | undefined;
}

export type UseFloatingReturn = Prettify<
  FloatingPosition & {
    /**
     * `FloatingContext`
     */
    context: Prettify<FloatingContext>;
    /**
     * Object containing the reference and floating refs and reactive setters.
     */
    refs: ExtendedRefs;
    elements: ExtendedElements;
  }
>;

export type UseFloatingData = Prettify<UseFloatingReturn>;

export interface UseFloatingOptions {
  rootContext?: FloatingRootStore | undefined;
  /**
   * Whether the floating element is open. Accepts an accessor to stay reactive.
   */
  open?: ReactiveBoolean | undefined;
  /**
   * Object of external elements as an alternative to the `refs` object setters.
   */
  elements?:
    | {
        /**
         * Externally passed reference element. Store in state.
         */
        reference?: ReferenceType | null | undefined;
        /**
         * Externally passed floating element. Store in state.
         */
        floating?: HTMLElement | null | undefined;
      }
    | undefined;
  /**
   * An event callback that is invoked when the floating element is opened or
   * closed.
   */
  onOpenChange?(open: boolean, eventDetails: RebaseUIChangeEventDetails<string>): void;
  /**
   * Unique node id when using `FloatingTree`.
   */
  nodeId?: string | undefined;
  /**
   * External FloatingTree to use when the one provided by context can't be used.
   */
  externalTree?: FloatingTreeStore | undefined;
  placement?: Placement | undefined;
  strategy?: Strategy | undefined;
  middleware?: Array<Middleware | null | undefined> | undefined;
  platform?: Platform | undefined;
  /**
   * Custom function to update the position while the elements are mounted.
   * Defaults to `autoUpdate` from `@floating-ui/dom`.
   */
  whileElementsMounted?: ((reference: ReferenceType, floating: HTMLElement, update: () => void) => () => void) | undefined;
}
