## defaultTriggerId — не нужен.

Причина использования в Base UI (React): defaultTriggerId существует из-за особенностей React SSR.

Решение: createUniqueId() из Solid уже даёт стабильный между сервером и клиентом id.

## Реактивность

Реактивными делаем пропы, описывающие состояние (open, disabled, value).

Структурные/конфигурационные пропы (as, id, defaultOpen, keepMounted, hiddenUntilFound, orientation при отсутствии смены на лету) читаем через untrack при инициализации.
