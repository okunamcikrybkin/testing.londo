# Роли фракций LONDO

## Первый запуск

1. Откройте `/faction-roles` под OWNER или FULL_ACCESS.
2. Выберите Discord text channel.
3. Для LSPD, LSCSD, FIB, EMS и SANG выберите реальные Discord-роли из списка и включите нужные фракции.
4. Нажмите «Сохранить», затем «Опубликовать панель».
5. Дальнейшее сохранение обновляет существующее сообщение. «Обновить панель» восстанавливает сообщение, если его удалили.

Изначально Role ID пустые, фракции выключены, сообщение не опубликовано. Роли не подбираются по названиям автоматически. При смене канала после успешной публикации bot удаляет собственное старое сообщение; даже если удалить его не удалось, старые кнопки отклоняются по ID сообщения и канала.

Требуются существующие настройки site↔bot, включая `LONDO_BOT_API_SECRET`. Секрет не передаётся браузеру. Bot необходимы View Channel, Send Messages, Read Message History, Manage Roles; выбранные роли должны находиться ниже высшей роли bot.

## Данные и надёжность

Migration `20260909090000_add_faction_roles` создана и применена стандартным `prisma migrate deploy` к текущей LONDO dev DB. Только новые таблицы: `faction_role_panel_settings`, `faction_role_buttons`, `faction_role_operations`; старые модели не изменялись. Prisma Client сгенерирован.

`FactionRoleOperation` хранит желаемое состояние роли и Discord interaction ID. Транзакция сериализует создание операции, повтор ID возвращает тот же результат; быстрые нажатия в пределах 2,5 секунды объединяются по времени Discord interaction. Незавершённая операция повторяется при следующем клике, а не переключает роль обратно. Каждое подтверждённое изменение записывается в AuditLog один раз. ID в кнопке обозначает запись фракции, а не Discord-роль.

Панель использует Components V2 и безопасный allowedMentions. До изменения роли проверяются сохранённая кнопка, enabled, текущий Role ID, guild, опубликованный message/channel, существование роли, managed/integration/bot flags, права и иерархия.

## Endpoints

- `GET /api/faction-roles` — настройки (OWNER/FULL_ACCESS).
- `GET /api/faction-roles?mode=options` — каналы и доступные роли через bot.
- `POST /api/faction-roles` — `save`, `publish`, `refresh`, с проверкой доступа и origin.
- `POST /api/internal/faction-roles` — secret-auth; операции `CATALOG`, `CLAIM`, `COMPLETE`, `PANEL`.
- `POST /internal/discord/faction-roles/options` — secret-auth, Discord channels/roles.
- `POST /internal/discord/faction-roles/publish` — публикация или редактирование текущего сообщения.
- `POST /internal/discord/faction-roles/refresh` — тот же безопасный workflow обновления.

События LONDO logs: `FACTION_ROLE_GRANTED`, `FACTION_ROLE_REMOVED`, `FACTION_ROLE_PANEL_PUBLISHED`, `FACTION_ROLE_PANEL_UPDATED`; дополнительно `FACTION_ROLE_SETTINGS_UPDATED`. Для изменений роли metadata содержит Discord user ID, role ID, имя фракции, timestamp.

## Изменённые файлы

Site (`C:/Users/asere/atemii-site`):

- `app/faction-roles/page.tsx`
- `app/api/faction-roles/route.ts`
- `app/api/internal/faction-roles/route.ts`
- `components/faction-roles-client.tsx`
- `components/header.tsx`
- `lib/faction-roles/service.ts`
- `lib/faction-roles/validation.ts`
- `lib/faction-roles/validation.test.ts`
- `lib/logs/data.ts`
- `prisma/schema.prisma`
- `prisma/migrations/20260909090000_add_faction_roles/migration.sql`
- `scripts/faction-roles-integration.ts`
- `package.json`
- `docs/FACTION_ROLES.md`

Bot (`C:/Users/asere/londo-bot`):

- `src/services/factionRoles.ts`
- `src/services/factionRoles.test.ts`
- `src/services/applicationServer.ts`
- `src/index.ts`

## Проверки

- Site: lint, TypeScript, build PASS; 71/71 tests PASS.
- Bot: lint, TypeScript PASS; 144/144 tests PASS.
- `npm run test:faction-roles-db`: 10 проверок на dev PostgreSQL, все тестовые записи откатываются общей транзакцией.
- Работающий bot: 92 канала и 53 управляемые роли; отсутствие secret отклоняется.
- Site: проверены отказ без secret для internal API, отказ без сессии для settings API и реальные начальные настройки.
- Изолированный UI-стенд с настоящим React-компонентом: выбор ролей, живой preview, отключение, порядок, добавление/удаление, сохранение и статус публикации. 1920/1440/1024/768/390 px — без горизонтального скролла. Тестовые данные стенда не записываются в dev DB и Discord.

Публикация и изменение ролей в Discord проверены через тестовые Discord-адаптеры; реальная панель пока не публиковалась, поскольку администратор ещё не выбрал канал и Role ID. Авторизованная страница в пользовательской сессии ожидает входа через Discord. Dev site и bot уже перезапущены с новой системой; дополнительных действий по restart сейчас не требуется.
