import { ScrollArea } from "@rebase-ui/solid/scroll-area";
import type {
  Coords,
  HiddenState,
  OverflowEdges,
  ScrollAreaContentProps,
  ScrollAreaContentState,
  ScrollAreaCornerProps,
  ScrollAreaCornerState,
  ScrollAreaRootProps,
  ScrollAreaRootState,
  ScrollAreaScrollbarProps,
  ScrollAreaScrollbarState,
  ScrollAreaThumbProps,
  ScrollAreaThumbState,
  ScrollAreaViewportProps,
  ScrollAreaViewportState,
  Size,
} from "@rebase-ui/solid/scroll-area";

import { expectType } from "#test-utils";

const rootProps = {} as ScrollArea.Root.Props;
const viewportProps = {} as ScrollArea.Viewport.Props;
const scrollbarProps = {} as ScrollArea.Scrollbar.Props;
const contentProps = {} as ScrollArea.Content.Props;
const thumbProps = {} as ScrollArea.Thumb.Props;
const cornerProps = {} as ScrollArea.Corner.Props;

const rootState = {} as ScrollArea.Root.State;
const viewportState = {} as ScrollArea.Viewport.State;
const scrollbarState = {} as ScrollArea.Scrollbar.State;
const contentState = {} as ScrollArea.Content.State;
const thumbState = {} as ScrollArea.Thumb.State;
const cornerState = {} as ScrollArea.Corner.State;

expectType<ScrollAreaRootProps, typeof rootProps>(rootProps);
expectType<ScrollAreaViewportProps, typeof viewportProps>(viewportProps);
expectType<ScrollAreaScrollbarProps, typeof scrollbarProps>(scrollbarProps);
expectType<ScrollAreaContentProps, typeof contentProps>(contentProps);
expectType<ScrollAreaThumbProps, typeof thumbProps>(thumbProps);
expectType<ScrollAreaCornerProps, typeof cornerProps>(cornerProps);

expectType<ScrollAreaRootState, typeof rootState>(rootState);
expectType<ScrollAreaViewportState, typeof viewportState>(viewportState);
expectType<ScrollAreaScrollbarState, typeof scrollbarState>(scrollbarState);
expectType<ScrollAreaContentState, typeof contentState>(contentState);
expectType<ScrollAreaThumbState, typeof thumbState>(thumbState);
expectType<ScrollAreaCornerState, typeof cornerState>(cornerState);

expectType<Coords, { x: number; y: number }>({ x: 0, y: 0 });
expectType<Size, { width: number; height: number }>({ width: 0, height: 0 });
expectType<HiddenState, { x: boolean; y: boolean; corner: boolean }>({ x: true, y: true, corner: true });
expectType<OverflowEdges, { xStart: boolean; xEnd: boolean; yStart: boolean; yEnd: boolean }>({
  xStart: false,
  xEnd: false,
  yStart: false,
  yEnd: false,
});

<ScrollArea.Root overflowEdgeThreshold={10}>
  <ScrollArea.Viewport>
    <ScrollArea.Content />
  </ScrollArea.Viewport>
  <ScrollArea.Scrollbar orientation="horizontal" keepMounted>
    <ScrollArea.Thumb />
  </ScrollArea.Scrollbar>
  <ScrollArea.Corner />
</ScrollArea.Root>;
