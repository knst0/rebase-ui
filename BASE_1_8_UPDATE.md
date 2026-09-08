# Обновление до Base UI 1.8.0

Порт построен на Base UI 1.7. Ниже — список изменений из релиза
[v1.8.0](https://base-ui.com/react/overview/releases/v1-8-0.md) с отметкой,
применимо ли изменение к этому репозиторию.

Компоненты, отсутствующие в порте (изменения пропускаем): Autocomplete, Drawer,
Menubar, Navigation Menu, Scroll Area, Toast, Toolbar, Preview Card, Meter,
Progress, Context Menu.

## 1. Общие изменения (`packages/core/src/internals`)

- [ ] **Ассоциация label при разрегистрации контрола.** `field/root`, `field/label`:
      при удалении контрола из Field `for`/`id` должны сбрасываться, а не залипать
      на исчезнувшем элементе.
- [ ] **Сокращение работы при завершении анимации.** `createAnimationsFinishedRunner.ts`,
      `runOnOpenChangeComplete.ts`: не запускать `getAnimations()`, если элемент
      не анимируется; кэшировать результат до следующего изменения `open`.
- [ ] **Слияние props и ref для lazy render-элементов.** `internals/render-element`:
      при отложенном (`enabled`) рендере props и ref должны мержиться так же, как
      в обычном пути.
- [ ] **Roving focus при добавлении/удалении элементов.** `internals/composite`:
      пересчитывать `activeIndex`/`tabIndex`, когда элементы монтируются или
      размонтируются, чтобы не терялся tab stop.
- [ ] **Исправления hover/focus взаимодействий.** `internals/floating/interactions/createHover.ts`,
      `createFocus.ts`.
- [ ] **Производительность монтирования триггеров.** Триггеры (`popover/trigger`,
      `select/trigger`, `menu/trigger`, `tooltip/trigger`, `combobox/trigger`):
      уменьшить работу при первом рендере.
- [ ] **Отслеживание disabled-якоря при скролле.** Позиционеры: не обновлять
      позицию для отключённого/размонтированного anchor.
- [ ] **`transform-origin` для выравнивания start/end.** `internals/floating` —
      расчёт origin в `positioner`/`popup`.
- [ ] **Удалить дублирующийся ключ `options` в arrow middleware.**
      В порте отдельного arrow middleware нет (`internals/floating` не содержит
      arrow-файла) — проверить, где вычисляется `Arrow` для popover/select/menu/
      tooltip/combobox, и убедиться, что дубля нет. Скорее всего N/A.
- [ ] **Регистрация passive touch-слушателей.** `internals/utils/addEventListener.ts`
      и все `touchstart`/`touchmove`/`wheel` подписки (`number-field/scrub-area`,
      `slider`, `createDismiss.ts`) — передавать `{ passive: true }` там, где
      `preventDefault` не вызывается.

## 2. Изменения по компонентам

### Avatar

- [x] Новый проп **`keepMounted`** у `<Avatar.Image>`
      (`avatar/image/AvatarImage.tsx`). Сейчас рендер завязан на `mounted` из
      `createTransitionStatus`; нужно добавить `keepMounted`, который держит
      `<img>` в DOM независимо от статуса загрузки.
  - Avatar.Image теперь всегда смонтирован.

### Checkbox / Checkbox Group

- [ ] Устаревшие и дублирующиеся `id` контрола (`checkbox/root`, `checkbox-group/root`).
- [ ] Валидация по blur и корректный `data-filled`.

### Combobox

- [ ] Новое коллекционное API **`createItems`** (в React — `useItems`/`createItems`).
      Затрагивает `combobox/collection` — сейчас там только `GroupCollectionContext`.
      Нужен публичный экспорт из `combobox/index.ts`.
- [ ] Исправления атрибута `readonly`.
- [ ] Рендер групп в grid-режиме (`combobox/row`, `combobox/group`).
- [ ] Сохранение фильтра при повторном открытии.
- [ ] Улучшения доступности + `aria-orientation`.

### Dialog / Alert Dialog

- [ ] Игнорировать outside click, если нажатие началось до открытия
      (`internals/floating/interactions/createDismiss.ts` — сравнивать время/
      `pointerdown` до `open`).

### Field

- [ ] Кастомная валидность и жизненный цикл валидации (`field/validity`, `field/utils`).
- [ ] Синхронизация controlled `value`.
- [ ] Валидация по Enter.
- [ ] Публикация состояния асинхронной валидации.

### Form

- [ ] `clearErrors` теряет обновления при изменении нескольких полей подряд.
      `form/Form.tsx:107` — `clearErrors` читает `errors()` и пишет новый объект;
      при нескольких синхронных вызовах промежуточные удаления теряются.
      Переписать через функциональный `setErrors((prev) => ...)`.

### Menu

- [ ] Переходы при изначально открытом подменю (`menu/submenu-*`, `menu/popup`).
- [ ] `aria-orientation` и правки дерева доступности.

### Number Field

- [ ] Обработка disable во время press-and-hold (`internals/createPressAndHold.ts`,
      `number-field/increment`, `number-field/decrement`).
- [ ] Запрет горизонтального wheel-скраббинга (`number-field/scrub-area`).
- [ ] Сохранение выделения в input.

### Popover

- [ ] Обработка outside click (см. общий пункт по `createDismiss`).
- [ ] Исправления миграции trigger store (`popover/store`, `popover/trigger`).

### Select

- [ ] `aria-orientation`.
- [ ] Якорение при множественном выборе (`select/positioner`).
- [ ] Просмотр списка в read-only режиме.
- [ ] Обработка root `id` внутри `Field` (`select/root` + `field/root`).

### Slider / Tabs

- [ ] Предотвращение циклов обновления из-за нестабильных ref
      (`slider/root`, `tabs/indicator`).
- [ ] Поддержка 3D-трансформаций при позиционировании индикатора табов
      (`tabs/indicator` — читать `matrix3d`, а не только `matrix`).

### Tooltip

- [ ] Учитывать задержку триггера при нулевой задержке провайдера
      (`tooltip/provider`, `tooltip/root`).

## 3. Порядок работ

1. Общие изменения в `internals` (dismiss, composite, render-element, passive listeners) —
   они закрывают часть пунктов Dialog/Alert Dialog/Popover/Menu разом.
2. Field + Form + Checkbox (общая цепочка валидации и id).
3. Новые API: `Avatar.Image` `keepMounted`, Combobox `createItems`.
4. Точечные фиксы: Number Field, Select, Slider/Tabs, Tooltip.
5. Тесты `vitest` на каждый пункт, затем `pnpm lint` и `pnpm test:chromium`.
