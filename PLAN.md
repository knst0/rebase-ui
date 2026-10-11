# План синхронизации с Base UI v1.9.0

Источник: https://base-ui.com/react/overview/releases/v1-9-0 (текущая база порта — v1.8.0).
Пути указаны относительно `packages/solid/src`. Номера строк — по состоянию на момент аудита, при правке перечитывать.
Не портированы у нас (PR неприменимы): Autocomplete, NavigationMenu, Menubar, ContextMenu, Toolbar, Progress.

Для каждого пункта: правка + тест рядом с кодом (+ docs, если указано). Перед работой прочитать `AGENTS.md` и `PORT_FIDELITY.md`.
Upstream-диффы: `gh pr diff <N> -R mui/base-ui`.

## 1. Collapsible / Accordion

- [x] #5705 `accordion/trigger/AccordionTrigger.tsx`: объединить `triggerOpenStateMapping` с `accordionStateAttributesMapping` (`accordion/item/stateAttributesMapping.ts`), `open` остаётся `data-panel-open`; добавить `index` в `AccordionTriggerDataAttributes.ts`; тест в `AccordionTrigger.test.tsx`; docs: строка `data-index`
- [x] #5607 убрать `focusableWhenDisabled: true` в `AccordionTrigger.tsx:31` и `collapsible/trigger/CollapsibleTrigger.tsx:29`; тесты: нативный `disabled`, не-нативный `aria-disabled` + `tabindex=-1`
- [x] #5514 `collapsible/panel/createCollapsiblePanel.ts` `handleBeforeMatch`: синхронно снять `data-starting-style`, `scheduleRevealRevert` (timeout 0 → rAF, вернуть `hidden="until-found"` через `setAttribute`, сбросить `shouldSkipNextOpen`), cleanup таймеров; тесты в `CollapsiblePanel.test.tsx`
- [x] #5890 ending-эффект: при `element === null` вызвать `setMounted(false)` + `setDimensions(EMPTY_DIMENSIONS, false)`; тест «render function removes the panel»
- [x] #5891 вынести `if (!open) setShouldPreventMountAnimation(false)` до раннего возврата при `element === null`; тест повторного открытия

## 2. Checkbox / Switch / Radio / RadioGroup

- [x] #5787 `internals/labelable-provider/createAriaLabelledBy.ts`: параметр `ariaLabel`, непустой → игнорировать `labelId` и fallback; передать из `CheckboxRoot.tsx:173`, `RadioRoot.tsx:124`, `SwitchRoot.tsx:111`; тесты в трёх компонентах
- [x] #5775 `radio-group/RadioGroup.tsx` (~89–135): убрать cleanup-return у `inputRef`, добавить эффект на `local.inputRef` (повторный вызов с текущим input, старый ref с `null` не вызывать); тест
- [x] #5643 стрелки при refocus — уже есть (`RadioGroup.tsx:282-291`)
- [x] #5787 OTP: wont-port — upstream ограничил `ariaLabel` тремя toggle-контролами (Checkbox/Radio/Switch); `OTPFieldRoot.tsx` на HEAD по-прежнему вызывает `useAriaLabelledBy` без `ariaLabel`, а `OTPFieldInput` игнорирует `aria-label` на первом слоте по дизайну (dev-ошибка ведёт на `<label>`/`<Field.Label>`); прокидывание сняло бы `inputAriaLabelledBy` у слотов без upstream-спеки
- [x] #5787 mount/unmount-тест: портирован вариант `Field.Label` (`CheckboxRoot.test.tsx`, реактивен через `labelId` + ноль `STRICT_READ_UNTRACKED`); вариант нативного `<label>` не выразим — fallback-`createRenderEffect` перезапускается только при смене трекаемых deps, а монтирование нативного label не меняет ни одну (upstream работает за счёт layout-эффекта без deps после каждого коммита; см. комментарий в `createAriaLabelledBy.ts`)

## 3. Field / Label / фокус

- [x] #5871 `internals/labelable-provider/createLabel.ts:40` и `slider/label/SliderLabel.tsx:33`: `getRootNode().getElementById(controlId)` вместо `ownerDocument`; тест в shadow DOM
- [x] #5345 владелец фокуса в `internals/field-root-context/FieldRootContext.ts` (аналог `useSetFieldFocused`, `let` + getter/setter, без `{current}`), сброс при `disabled`
  - [x] перевести `setFocused` в: `CheckboxRoot`, `FieldControl`, `ComboboxInput`, `ComboboxTrigger`, `NumberFieldInput`, `OTPFieldRoot`, `RadioGroup`, `SelectTrigger`, `SliderThumb`, `SwitchRoot`
  - [x] тест: сфокусированный контрол стал disabled → focused у Field сбросился
- [x] #5881 `field/control/FieldControl.tsx:67-77`: решить, нужна ли пересинхронизация filled при смене `defaultValue` (предупреждения у нас нет); если да — тест

## 4. Scroll Area / Toast / NumberField / OTP / Tabs

- [x] #5813 убрать `role: "presentation"` из `scroll-area/viewport/ScrollAreaViewport.tsx:396`; тест
- [x] #5809 `toast/viewport/ToastViewport.tsx`: `set("hovering", false)` → `if (!select("expandedOrOutOfFocus")) resumeTimers()`; удалить `resumeTimersIfWindowFocused`; обновить `flushMouseLeave` и `handleBlur`; тесты viewport и `ToastStore.test.ts`
- [x] #5889 `number-field/scrub-area/NumberFieldScrubArea.tsx`: синтетический клик в `finish()` через `setTimeout(0)`, пропуск при уже полученном нативном клике, сброс в `handlePointerDown`, очистка в `onCleanup`; тест
- [x] #5098 `otp-field/input/OTPFieldInput.tsx`: IME — `composingValue`, `compositionstart` (кроме Android), одна фиксация на `compositionend`, ранний выход из `handleKeyDown`; общий `commitValue` для `handleTextInput`/`handlePaste`; тесты
- [x] #5886 Tabs, функция как значение — уже есть (`internals/createControllableSignal.ts`)

## 5. Slider (`slider/control/SliderControl.tsx`)

- [x] #5639 `touchcancel`/`pointercancel`: гард в `handleTouchEnd`, `handlePointerCancel`, `touchId = null` в `stopListening`, подписка/отписка слушателей
- [x] #5779 флаг `pointerGesture` + `isTouchLikePointerType` (рядом с `isMouseLikePointerType`, `internals/floating/utils/event.ts:57`); `handleTouchStart` не дублирует `startPressing`
- [x] #5781 `isArrayValue` в `SliderRoot.tsx`/`SliderRootContext.ts`; `getFingerState` возвращает `[newValue]` для массива из одного элемента; `SliderThumb.tsx:375` использует `isArrayValue()`
- [x] тесты: `SliderInteraction.test.tsx`, `SliderRoot.test.tsx`

## 6. Dismiss / Dialog / общие утилиты

- [x] #5780 `internals/floating/interactions/createDismiss.ts`: убрать `clearInsideReactTree()` из cleanup floating-эффекта (~691), добавить `onCleanup(clearInsideReactTree)` на уровне владельца; сначала воспроизвести сценарий closed shadow root
- [x] #5865 (часть) `createDismiss.ts`: учитывать `isComposing` нативного события в Escape (~191), вынести `compositionTimer` за пределы эффекта, сбрасывать `isComposing` при закрытии; тест в `interactions.test.ts`
- [x] #5719 `internals/createAnimationsFinishedRunner.ts` (~71, ~92) и `ScrollAreaViewport.tsx:319,327`: игнорировать анимации с `Infinity` (duration/iterations), `finished.then(NOOP)`; тест

## 7. Popups и Menu: поведение

- [x] #4261 общий `internals/useTriggerSwitchTransition.ts` из `menu/positioner/MenuPositioner.tsx` (~213–230); применить в `popover/positioner/PopoverPositioner.tsx` (~92–110); `instantType` в `MenuStore.ts:60` и `PopoverStore.ts:40` → `undefined` при закрытом; тест
- [x] #5733 focus guards
  - [x] `internals/floating/utils/tabbable.ts:215-240`: экспортируемый `getTabbableNearElement(ref, direction, exclude?)` вместо `getTabbableAfterElement`/`getTabbableBeforeElement`
  - [x] `internals/popups/popupTriggerFocusGuards.ts`: перевести на него, `beforeTriggerFocusGuardRef` в контексте `MenuStore` и `PopoverStore`
  - [x] `internals/floating/components/FloatingFocusManager.tsx:915`: не возвращать фокус при `focusOut` с focus-guard триггером
  - [x] `PopoverTrigger.tsx:224`, `MenuTrigger.tsx`: `isOpenedByThisTrigger` вместо `isMountedByThisTrigger`
  - [x] `PopoverPopup.tsx:183-197`, `MenuPopup.tsx:182-194`: `getInsideElements`
  - [x] тест Shift+Tab с триггера
- [x] #5738 `internals/popups/popupStoreUtils.ts:468-477`: `store.set("mounted", mounted())` синхронно; `popupStoreState.ts:174-175`: `open && !mounted ? "starting" : transitionStatus`; тест initially-open popup
- [x] #5789 Menu: `internals/utils/dispatchClickWithModifiers.ts` опция `pointerType`; `useMenuItem.ts:76` → `"mouse"`; `createMenuRoot.ts:140-146` touch-guard не для `itemPress` (проверить условие по upstream-диффу)
- [x] #5793 `MenuPopup.tsx:193` убрать `isTopLevel`; `MenuSubmenuTrigger.tsx` закрывать по `focusout` через guard (`REASONS.focusOut`)
- [x] #5824 `MenuSubmenuTrigger.tsx:297-301`: toggle при повторной активации, `stickIfOpen` для `openOnHover`
- [x] #5816 `internals/floating/interactions/createTypeahead.ts` (~183–207): `onTyping(false)` при сбросе буфера на закрытии; тест
- [x] #5819 `internals/composite/composite.ts:143-160`: быстрый путь по `previousElementSibling`/`nextElementSibling` в `sortByDocumentPosition`; тест в `composite.test.ts`
- [x] #5641 popup без триггера — уже есть (`openedWithoutTrigger`)
- [x] #5887 viewport при ремаунте триггера — уже есть (`popupViewport.tsx:154-157`)
- [x] #5645 вложенные меню без root-триггера — уже есть
- [x] #5764 cleanup mouseup в `MenuTrigger` — уже есть
- [x] #5833 подписка parent-store submenu — уже есть (Solid-сигналы)

## 8. Select / Combobox

- [x] #5734 `preventUnmountOnClose` вместо гейтинга по `actionsRef`
  - [x] `createComboboxRoot.ts:1443-1458`, `createSelectRoot.ts:437-447`: убрать `hasActionsRef`
  - [x] `preventUnmountOnClose()` в деталях `onOpenChange` (через `attachPreventUnmountOnClose` в `setOpen`), reason `imperativeAction`
  - [x] действие `close` в `AriaCombobox.tsx:100-108` и `SelectRoot.tsx:57-66`
  - [x] гард `if (!untrack(mounted)) return` в `handleUnmount` и `forceUnmount` (`internals/popups/popupStoreUtils.ts` ~470–478)
  - [x] тесты: авто-unmount с `actionsRef`, повторный `unmount()`, `close` с opt-out, `unmount` при открытом
  - [x] docs: API-референс Combobox и Select
- [x] #5818 `createComboboxRoot.ts`: сброс `pendingQueryHighlight` (см. `setOpen`, ~1155–1170), `activeIndex = 0` только если есть `candidateItems[0]`; тесты async + `autoHighlight`
- [x] #5879 убрать `highlightedChipIndex` (`ComboboxChips`, `ComboboxChipsContext`, `ComboboxChip`, `ComboboxInput`), сверить с upstream-диффом; тесты чипов
- [x] #5838 `onItemHighlighted` получает событие
  - [x] `getHighlightReason(event)` в `internals/utils/`, тип `BaseUIHighlightEventDetails`
  - [x] Combobox: `event` через `setIndices`/`emitHighlight`, удалить `keyboardActiveRef`
  - [x] Menu: `createMenuRoot.ts:344` `setActiveIndex(…, event)`, `useMenuItem` `setActive(event)`
  - [x] `createTypeahead.ts`: `onMatch(index, event)`
  - [x] тесты reason/event; docs: Combobox `onItemHighlighted`, `menu/types.md`
- [x] #5710 типы: input `readonly Value[]` / output `Value[]` для `ComboboxRoot.tsx:38`, `SelectRoot.tsx:344-352`, `AriaCombobox.tsx`; docs types
- [x] #5589 перенести root-пропсы Select (`disabled`, `readOnly`, `required`, `multiple`, `highlightItemOnHover`, `itemProps`) из `SelectRootPropsContext` в стор; удалить контекст; обновить `SelectItem.tsx`, `SelectPopup.tsx`
- [x] #5728 общий `internals/utils/ItemIndicator.tsx` для `ComboboxItemIndicator` и `SelectItemIndicator`
- [x] #5863 объединение подписок на стор — неприменимо (per-key сигналы)
- [x] #5862 CompositeList и StrictMode — неприменимо

## 9. Drawer

- [x] #5658 `drawer/utils/createSwipeDismiss.ts`: `MIN_VELOCITY_SAMPLE_DISTANCE = 1`, `hasStationarySample`, сброс в `reset`/`handleStart`/`isFirstPointerMove`, release по `deltaFromLastSample`
- [x] #5845 `MIN_RELEASE_VELOCITY_DURATION_MS` 16 → 4 (после #5658)
- [x] #5844 `drawer/utils/scrollable.ts`: `findScrollableAncestor` вместо `hasScrollableAncestor`; обновить `createSwipeDismiss.ts:9,480`; тест SVG-цели
- [x] #5864 `DrawerViewport.tsx` (~631–665): `!open || !mounted` в раннем возврате эффекта touchmove; тест
- [x] #5808 `x`/`y` у `data-base-ui-swipe-ignore`: `AXIS_SWIPE_IGNORE_SELECTORS`, `hasCrossAxisGestureTarget`, правки `touchstart`/`canStart`/`shouldYieldTouchMove`; docs `drawer/index.mdx`; тесты
- [x] #5770 `drawer/root/DrawerRoot.tsx:183-202`: CloseWatcher `cancel` вместо `close`, `preventDefault` при `isCanceled`; тесты
- [x] `drawer/virtual-keyboard-provider/DrawerVirtualKeyboardProvider.tsx` (тесты в `DrawerVirtualKeyboardProvider.test.tsx`)
  - [x] #5768 удалить `KEYBOARD_SCROLL_SLACK`, пересчитать padding
  - [x] #5769 capture-слушатель `focus`, повторный `focus({ preventScroll: true })`
  - [x] #5774 closure `getKeyboardViewport`, probe `100svh`, `resizing`, слушатель `resize`
  - [x] #5882 `releaseFocusedKeyboardTarget`, замена в `handleFocusIn`/`handleFocusOut`
- [x] #5921 утечка drawers в Provider — уже есть (`DrawerProvider.tsx:17-30`)

## 10. Экспорты типов (#5243)

- [x] добавить `export * as XDataAttributes` / `export * as XCssVariables` в `index.ts` всех портированных компонентов (122 файла `*DataAttributes`, 25 `*CssVars`)
- [x] создать `dialog/viewport/DialogViewportDataAttributes.ts` и `alert-dialog/trigger/AlertDialogTriggerDataAttributes.ts`
- [x] #5901 (в окне v1.9.0, вне #5243): `fieldset/legend/FieldsetLegendDataAttributes.ts` + экспорт в `fieldset/index.ts`; `data-disabled` уже рендерился через дефолтный маппинг `stateToAttributes`; тесты в `FieldsetLegend.test.tsx`, покрытие в `metadata-exports.test.ts` (161 неймспейс)
- [x] docs: `types.md` → локальный эквивалент: generated `<ApiReference>` (`collectApi` сканирует `*DataAttributes.ts` из исходников, тест в `collect.test.ts`); отдельные `types.md` не портируются; блоки добавлены на страницы dialog и fieldset (остальные 20 страниц без блока — выкат вне скоупа §10)
- [x] проверить сборку и package-контракт (`pnpm test:package`)

## 11. Menu filtering (#5527), preview — отдельной задачей

Объём upstream: 70 source-файлов, 45 test-файлов, 11 docs-файлов. #5840 и #5868 входят сюда.

- [x] shared prereqs: `internals/filter.ts`, `resolvePopupLabel.ts`, `resolveRenderedId.ts`, `useItemRegistry.ts`
- [x] расширения: `FloatingFocusManager` (`explicitReturnFocus`), `anchor-positioning` (`lazyFlip: 'placement'`), guard в transition-status
- [x] слой filter-dropdown
- [x] состояние фильтра в `MenuStore` / `MenuRoot`
- [x] `Menu.FilterProvider`, `Menu.Input`, `Menu.List`, `Menu.Empty`, `Menu.Clear` и внутренние `filter-root`/`filter-submenu-root`
- [x] обёртки item, изменения popup/submenu
- [x] #5840 фокус input при нажатии на не-item контент списка
- [x] #5868 WebKit selection state только для сфокусированного input
- [x] экспорты (`index.ts`, `index.parts.ts`)
- [x] docs: `menu/page.mdx`, `menu/types.md`, демо фильтров, страница experiments, `error-codes.json`

## 12. Финализация

- [x] `.changeset/*.md` на изменения
- [x] обновить docs по затронутым компонентам
- [x] `pnpm typecheck`, `oxlint`, `oxfmt`
- [x] тесты: затронутые vitest-наборы, `pnpm test:ci`, `pnpm test:package`
- [x] регрессия: нет `STRICT_READ_UNTRACKED` в новых путях (см. `DialogRoot.test.tsx`, `ComboboxListDiagnostics.test.tsx`)
- [x] обновить `.agents/memory/learnings.md`: база порта v1.9.0
