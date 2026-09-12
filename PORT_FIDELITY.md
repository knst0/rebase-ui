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

## Стор-состояние с синхронным чтением

В Solid 2.0 записи в сигналы батчатся (видны чтениям только после flush),
а интерактивная логика floating-ui читает состояние синхронно сразу после
записи (`updateState` → `select`/`syncOpenEvent` в том же тике).
Поэтому сторы держат синхронный снапшот — plain-объект как единственный
источник правды (как `this.state` в upstream), а реактивность даёт отдельный
сигнал версии:

```tsx
private snapshot: State;
private readonly trackVersion: Accessor<number>;
private readonly bumpVersion: () => void;

updateState = (next: Partial<State>) => {
  this.snapshot = { ...this.snapshot, ...next };
  this.bumpVersion();
};

select = (key) => {
  this.trackVersion(); // подписка; вне вычислений — no-op
  return this.snapshot[key];
};
```

Чтения внутри `select`/`state`/аксессоров обязаны идти из `snapshot`,
а не из сигнала. Референс: `FloatingRootStore`.
