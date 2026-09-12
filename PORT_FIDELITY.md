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
let el: HTMLInputElement;
```

```tsx
import { createSignal } from "solid-js";

const [el, setElement] = createSignal();
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
private readonly keyVersions = new Map<string, VersionSignal>();
private readonly trackingSnapshot: State; // Proxy: чтение поля подписывает вычисление только на это поле

updateState = (next: Partial<State>) => {
  const prev = this.snapshot;
  this.snapshot = { ...prev, ...next };
  for (const key of Object.keys(next)) {
    if (!Object.is(prev[key], this.snapshot[key])) {
      this.bumpKey(key); // только реально изменившиеся ключи
    }
  }
};

select = (key) => {
  return resolve(this.trackingSnapshot, key); // подписка только на прочитанные поля
};

peek = (key) => {
  return resolve(this.snapshot, key); // разовое чтение без подписки
};
```

Чтения внутри `select`/`state`/аксессоров обязаны идти из `snapshot`,
а не из сигнала. Референс: `FloatingRootStore`.

Правила:

- `select`/`useState` — только в отслеживаемом скоупе (compute эффекта, JSX, memo).
  Чтение `select` в apply-колбэке эффекта или в обработчике, вызванном синхронно
  из apply, даёт `STRICT_READ_UNTRACKED`: предупреждение, что чтение не подпишется.
- Разовые чтения в обработчиках событий, слушателях эмиттера, таймаутах
  и apply-колбэках — только через `peek`/`peekState` (сигнал вообще не читается).
- Один общий сигнал версии запрещён: тысячи подписчиков на одном сигнале дают
  `HUGE_FAN_OUT` — каждое изменение перезапускает все вычисления. Версия —
  отдельный сигнал на каждое поле снапшота; селектор через прокси подписывается
  только на поля, которые реально прочитал. Писатели (`set`/`update`/`updateState`)
  дёргают версию только изменившихся ключей.
