# GREEN-API Test Chat

Клиентский чат на React: вход по учетным данным GREEN-API, личные текстовые сообщения в Telegram. Внешний вид — в духе чата MAX.

Документация и правила для агентов — в `spec/` и `AGENTS.md`. Это источник истины, а не код «как обычно делают мессенджеры».

| Файл | Содержание |
| --- | --- |
| [spec/0-tech-spec.md](spec/0-tech-spec.md) | ТЗ |
| [spec/01-code-style.md](spec/01-code-style.md) | Стек, файлы, стиль |
| [spec/02-agent-rules.md](spec/02-agent-rules.md) | Как работать агенту |
| [spec/03-business-logic.md](spec/03-business-logic.md) | Поведение |
| [spec/04-green-api-contract.md](spec/04-green-api-contract.md) | Методы API |
| [spec/05-ui.md](spec/05-ui.md) | Экраны и токены |

Технический каркас приложения собран на Vite, React и TypeScript. Бизнес-функциональность пока не реализована.

## Команды

```bash
npm install
npm run dev
```

- `npm run build` — проверить типы и собрать production-версию;
- `npm run typecheck` — проверить типы;
- `npm run lint` — проверить код ESLint;
- `npm run format` — отформатировать код Prettier;
- `npm run format:check` — проверить форматирование;
- `npm run test` — запустить Vitest в watch-режиме.
