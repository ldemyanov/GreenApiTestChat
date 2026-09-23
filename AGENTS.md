# Агенты

Источник истины — каталог `spec/`. Не реализуй поведение по аналогии с WhatsApp, MAX API или другими мессенджерами.

## Перед кодом

1. Прочитай [spec/0-tech-spec.md](spec/0-tech-spec.md), [spec/01-code-style.md](spec/01-code-style.md), [spec/03-business-logic.md](spec/03-business-logic.md).
2. Для запросов — [spec/04-green-api-contract.md](spec/04-green-api-contract.md). Для вёрстки — [spec/05-ui.md](spec/05-ui.md).
3. Следуй [spec/02-agent-rules.md](spec/02-agent-rules.md).

Если пользователь меняет договорённости, обнови соответствующий файл в `spec/`.

## Запрещено в этой версии

Группы, вложения, цитирование, редактирование и удаление сообщений, отметки прочтения, импорт контактов, история из Telegram, `localStorage`/`sessionStorage` для сессии, роутер, axios и другие HTTP-клиенты, UI-kit, webhook, `SetSettings`, автонастройка инстанса, отправка по `phoneNumber@c.us` вместо `chatId`.

## Проверка

Запускай только применимые проверки из проекта. В итоге укажи, что изменено, что реально запускалось и что не проверялось.
