# Контракт GREEN-API (Telegram)

Минимальный набор методов текущей версии. Поведение очереди и сессии — в [бизнес-логике](./03-business-logic.md).
Официальные страницы имеют приоритет при расхождении с примерами ниже.

Реальные запросы для ручной интеграционной проверки выполняет пользователь самостоятельно.
Агент проверяет реализацию только с подменой API, без обращений к GREEN-API.

Не использовать документацию WhatsApp и не отправлять новые сообщения как `номер@c.us`.

## Базовый URL

Пользователь вводит только `idInstance` и `apiTokenInstance`. В текущей версии хост выводим из `idInstance`:

```
https://{idInstance.slice(0, 4)}.api.green-api.com
```

Пример: `idInstance` `4100123456` → `https://4100.api.green-api.com`.

Официальная документация указывает `apiUrl` как отдельный параметр доступа из личного кабинета.
Формула выше — допущение текущего проекта, поскольку по ТЗ пользователь вводит только два поля.
До реализации остальных методов её требуется проверить реальным вызовом `GetStateInstance` для тестового инстанса
и сопоставить с `apiUrl` в кабинете. Если адрес отличается, контракт нужно обновить; перебирать хосты нельзя.
[Параметры доступа](https://green-api.com/telegram/docs/before-start/).

Шаблон пути (как в кабинете GREEN-API, префикс `waInstance` сохраняем):

```
{apiUrl}/waInstance{idInstance}/{method}/{apiTokenInstance}
```

Токен входит в URL. Полный URL не логируем и не показываем пользователю.

Общий клиент: `fetch`, JSON, различать HTTP-ошибку, сеть и `AbortError`.

- `GetStateInstance`, `CheckAccount`, `SendMessage` и `DeleteNotification`: отмена клиентом через 15 секунд.
- `ReceiveNotification`: `receiveTimeout=20`, отмена клиентом через 30 секунд, чтобы сервер успел вернуть ответ.
- Таймаут `SendMessage` означает неопределённый результат `unknown`, потому что API мог принять запрос.
- Пользовательский выход и замена сессии отменяют запросы без показа ошибки.

До разработки полного интерфейса выполнить ручную интеграционную проверку из браузера:
`GetStateInstance`, `CheckAccount`, `SendMessage`, `ReceiveNotification` и `DeleteNotification`.
Проверка должна подтвердить вычисление `apiUrl` и разрешение CORS для `GET`, `POST` и `DELETE`.
Если браузер блокирует любой обязательный метод, прямой клиентский вариант архитектуры требует пересмотра.

## GetStateInstance

- `GET …/getStateInstance/{token}`
- Успех: `{ "stateInstance": "authorized" }` (и другие значения из API).
- Сессию открываем только при `authorized`. Остальные состояния — ошибка подготовки инстанса, без цикла получения.

[Документация](https://green-api.com/telegram/docs/api/account/GetStateInstance/).

## CheckAccount

- `POST …/checkAccount/{token}`
- Тело: `{ "phoneNumber": 79876543210 }` — число, без `+`, без `username`, без `force`.
- Успех: `{ "exist": true, "chatId": "10000000", … }`. Дальше работаем со строковым `chatId`.
- Нет аккаунта или скрыт номер: `{ "exist": false, "chatId": "" }` — чат не создаём.
- Ошибка в теле при HTTP 200 возможна: `{ "status": false, "reason": "…" }` или `data.reason === "rate_limit_exceeded"` с `retryAfter`. Чат не создаём.

[Документация](https://green-api.com/telegram/docs/api/service/CheckAccount/).

## SendMessage

- `POST …/sendMessage/{token}`
- Тело: `{ "chatId": "10000000", "message": "текст" }`. Без `quotedMessageId` и typing.
- Успех: `{ "idMessage": "1769676078000" }` — состояние `accepted`, не доставка.
- `message` не длиннее 4096 символов (проверка до запроса).

[Документация](https://green-api.com/telegram/docs/api/sending/SendMessage/).
[chatId](https://green-api.com/telegram/docs/api/chat-id/): личный чат — строка положительного числа (`"10000000"`).

## ReceiveNotification

- `GET …/receiveNotification/{token}?receiveTimeout=20`
- `receiveTimeout` в диапазоне 5–60, в проекте фиксируем `20`.
- Нет события: пустое тело (после trim нет JSON) — это не ошибка, запрашиваем снова.
- Есть событие:

```json
{
  "receiptId": 1234567,
  "body": { }
}
```

`receiptId` — только для `DeleteNotification`. Чат берём из `body.senderData.chatId`.
Время: `body.timestamp` в секундах → для UI `timestamp * 1000`.

Текст входящего:

- сначала проверяем `typeWebhook === "incomingMessageReceived"` и `senderData.chatType === "user"`;
- `messageData.typeMessage === "textMessage"` → `messageData.textMessageData.textMessage`;
- `messageData.typeMessage === "extendedTextMessage"` → `messageData.extendedTextMessageData.text`
  (превью ссылки не строим).

Исходящие вебхуки, группы, вложения и прочие типы: не добавляем в переписку, подтверждаем уведомление.

[ReceiveNotification](https://green-api.com/telegram/docs/api/receiving/technology-http-api/ReceiveNotification/).
[textMessage](https://green-api.com/telegram/docs/api/receiving/notifications-format/incoming-message/TextMessage/).
[extendedTextMessage](https://green-api.com/telegram/docs/api/receiving/notifications-format/incoming-message/ExtendedTextMessage/).

## DeleteNotification

- `DELETE …/deleteNotification/{token}/{receiptId}`
- Успех: `{ "result": true, "reason": "" }`.
- `{ "result": false }` для уже удалённого — не крутить ожидание `true`; сверить очередь следующим `ReceiveNotification`, как в бизнес-логике.

[Документация](https://green-api.com/telegram/docs/api/receiving/technology-http-api/DeleteNotification/).

## Фикстуры для тестов

В тестах только вымышленные `idInstance` / токен. Мокать `fetch`, не вызывать сеть.

Минимальный входящий текст (поле `body` ответа `ReceiveNotification`):

```json
{
  "typeWebhook": "incomingMessageReceived",
  "timestamp": 1763115112,
  "idMessage": "1763115112345",
  "senderData": {
    "chatId": "10000000",
    "chatType": "user",
    "chatName": "Василиса",
    "sender": "10000000",
    "senderName": "Василиса"
  },
  "messageData": {
    "typeMessage": "textMessage",
    "textMessageData": { "textMessage": "Привет" }
  }
}
```
