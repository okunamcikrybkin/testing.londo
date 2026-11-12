# LONDO Отпуск

Реализовано в текущих проектах atemii-site и londo-bot. Прежнего AFK workflow в исходниках не было; FAMILY_AFK_CHANNEL_ID относится только к voice tracker и не изменялся.

## Установка

Migration 20260905220000_add_family_afk применена 2026-09-05 через prisma migrate deploy к подтверждённой пользователем новой dev DB LONDO/atemii. Созданы AfkApplication и AfkSession, индексы и ограничения длительности/дубликатов. Остальные таблицы и migrations не переписывались. Prisma Client generated. Для освобождения DLL были остановлены только точно определённые процессы Next dev этого сайта.

В londo-bot/.env задайте MEMPHIS_HOLIDAY_ROLE_ID — ID специальной роли отпуска Discord в Memphis (если переменная не задана, используется совместимая FAMILY_HOLIDAY_ROLE_ID). Не используйте ID семейной роли или voice AFK channel. Роль отпуска должна быть ниже высшей роли bot; bot требуется Manage Roles. Не меняйте ID роли, пока существуют незавершённые sessions, использующие прежний ID.

Перезапустите site и bot. Администратор Discord выполняет /setup-afk в нужном текстовом канале. Команда обновляет найденную панель с маркером londo-afk-approval либо создаёт её, если панели нет среди последних 100 сообщений. Требуются View Channel, Send Messages, Embed Links и Read Message History.

Переиспользуются LONDO_SITE_URL, LONDO_BOT_INTERNAL_URL и LONDO_BOT_API_SECRET. Значения секретов не выводятся и не передаются браузеру.

## Пользователь

«Уйти в отпуск» доступно только участникам Memphis; Submit повторно проверяет активное FamilyMembership. Срок: HH:MM DD.MM.YYYY, HH:MM DD.MM, HH:MM, 10m, 2h, 3d. Даты без зоны трактуются в Europe/Berlin; время без даты — ближайшее будущее совпадение, дата без года — ближайшее будущее совпадение в текущем/следующем году. Причина: 1–1000 символов после trim. До одобрения роль не выдаётся.

Повторная доставка одного Discord interaction использует тот же requestKey. Для Memphis запрещены одновременно PENDING/APPROVING/APPROVED заявки; отдельный partial unique index защищает live sessions. Старые Phoenix-записи остаются в БД, но не участвуют в активной обработке.

«Список отпусков» показывает только действующие Memphis ACTIVE sessions без причин и reviewer. «Вернуться из отпуска» завершает собственную session; выйти можно даже после утраты membership.

## Staff

Страница /memphis/afk: Ожидают, Активные, История; фильтры пользователя и статуса. Выводится до 300 последних совпадений, историю можно уточнить фильтром. Карточка добавлена в Memphis; roster показывает компактный badge ОТПУСК.

Права строго переиспользуют getApplicationStaffUser/canManageApplications: OWNER/FULL_ACCESS. Текущая архитектура не даёт HIGH_STAFF права управления family applications, поэтому новых семейных или глобальных прав ему не добавлено. API повторно проверяет права и выбирает заявку по id + family.

Отклонение требует причину. Досрочное завершение требует подтверждение. AuditLog хранит создание, одобрение, отклонение, начало, окончание, выдачу/снятие роли и ошибку выдачи; существующий LogEvent allowlist не менялся.

## Согласованность и восстановление

Approve проверяет актуальное membership, время, роль и Discord member. В транзакции создаётся GRANTING session и сохраняется APPROVING application. Затем синхронизация Discord подтверждает выдачу, и транзакция переводит их в ACTIVE/APPROVED. UI не показывает GRANTING как активный отпуск.

При подтверждённой неудаче выдачи bot компенсирует новые роли, session становится FAILED, application возвращается в PENDING. При неоднозначной сетевой ошибке сохраняется промежуточное состояние и понятная ошибка; повторная синхронизация восстанавливает результат. Для удаления используются ENDING intents; после подтверждения Discord фиксируются ENDED и endedAt. Повторное окончание не создаёт новую историю и не снимает общую роль, пока другая session требует её.

Все операции пользователя сериализуются блокировкой строки существующей DiscordIdentity в PostgreSQL. Старые Phoenix-сессии не удаляются и не меняются. Исходные membership, coins, XP и voice timers не изменяются.

Bot запускает TICK при старте и каждые 60 секунд. Он восстанавливает GRANTING/ENDING/FAILED intents и завершает истёкшие sessions на основе DB. Если site или Discord недоступны, операция остаётся для повторной обработки; физическое снятие роли может задержаться до восстановления связи. PENDING заявки с истёкшим запрошенным временем автоматически CANCELLED. История не удаляется.

## API

- GET/POST /api/afk/[family]: staff list, approve, reject, end.
- POST /api/internal/afk: защищённые операции VIEW, SUBMIT, END, TICK.
- POST /internal/discord/afk/check и /sync: существующий bot HTTP listener, x-londo-bot-secret.

## Проверки

Site: 25 unit tests, lint, tsc --noEmit, build — успешно. Bot: 92 tests, lint, tsc --noEmit — успешно. Все прежние тесты входят в эти результаты.

scripts/afk-db-check.ts: 12 проверок реального PostgreSQL workflow, включая ошибку выдачи, повторное одобрение, dual-family с общей ролью, early end, expiry, user exit и историю. Все fixtures создаются внутри одной транзакции и откатываются; отсутствие тестовой identity после rollback проверено. Discord в этом тесте заменён адаптером.

Дополнительно проверены 12 HTTP-отказов/redirects сайта без авторизации и 401 для обоих bot endpoints. Настоящую Discord-выдачу следует проверить после настройки MEMPHIS_HOLIDAY_ROLE_ID и перезапуска bot; действующих пользователей во время разработки не переводили в AFK.

Обновление интерфейса 2026-09-06: панель «Отпуск» использует Components V2 — описание, форматы и три Section/Button строки. После restart site/bot повторите /setup-afk: старая embed-панель будет обновлена, новая V2-панель переиспользуется. Prisma schema, migration, URL, env и approval/auto-end workflow не менялись.
