## defaultTriggerId — не нужен.

Причина использования в Base UI (React): defaultTriggerId существует из-за особенностей React SSR.

Решение: createUniqueId() из Solid уже даёт стабильный между сервером и клиентом id.

## Реактивность

Реактивными делаем пропы, описывающие состояние (open, disabled, value).

Структурные/конфигурационные пропы (as, id, defaultOpen, keepMounted, hiddenUntilFound, orientation при отсутствии смены на лету) читаем через untrack при инициализации.

## ref.current

В Solid.JS `Ref<HTMLInputElement>` заменяется на просто `HTMLInputElement`.
Не нужно делать обвязки в виде `lastChangeReasonRef: { current: SliderRoot.ChangeEventReason }`, просто `lastChangeReason: SliderRoot.ChangeEventReason`. Это лишняя абстракция, которая ничего не дает.

Референс элемента может быть создан через:

```tsx
let el: HTMLInputElement
```

```tsx
import { createSignal } from "solid-js";

const [el, setElement] = createSignal()
```
