# Known failures

## Combobox positioner: manual unmount crashes the signals graph

- **Test**: `src/combobox/positioner/ComboboxPositioner.test.tsx` ›
  "repositions a retained popup after a completed close"
- **Error**: `TypeError: Cannot read properties of undefined (reading 'nextSub')`
  at `reze-js/packages/signals/src/graph.ts:257` (`checkDirty`), reached via
  `RenderNode.run` → `flushGlobal` on the `tick()` after the manual
  `actions.unmount()` call.
- **Status**: deterministic, fails in isolation and in the full suite.
- **Scope**: the crash is inside the signals dependency graph (a render node
  reading a disposed dependency during flush). No rebase-ui frames are on the
  stack. The equivalent Solid test passes, and the sibling Select retain tests
  (`src/select/root/SelectRoot.test.tsx`) pass against the same shared
  floating/popups machinery, so the trigger is specific to the combobox manual
  unmount + remount sequence, not the ported component logic.
- **Repro**: `pnpm --filter @rebase-ui/reze exec vp test run
  --project @rebase-ui/reze src/combobox/positioner/`
