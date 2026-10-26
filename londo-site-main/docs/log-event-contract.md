# LONDO Log Event Contract

The website records its own actions in `AuditLog`. The separate LONDO Bot sends only normalized Discord/domain events to `POST /api/internal/logs`; it must never access the site database directly.

## Authentication and idempotency

- Send `x-londo-bot-secret: <LONDO_BOT_API_SECRET>` (or a Bearer token).
- `sourceEventId` is mandatory and unique for source `LONDO_BOT`. Retrying the same event is safe and does not duplicate it.
- The endpoint accepts no role, permission, arbitrary action, category, or database operation from a caller. `type` is allowlisted and the site derives its action/category.

## Payload

```json
{
  "sourceEventId": "discord-event-or-bot-uuid",
  "type": "RANK_CHANGED",
  "family": "MEMPHIS",
  "serverId": "discord-guild-id",
  "actor": { "discordId": "...", "username": "...", "displayName": "..." },
  "target": { "discordId": "...", "username": "...", "displayName": "..." },
  "summary": "Ранг участника изменён",
  "result": "SUCCESS",
  "metadata": { "fromRank": "...", "toRank": "..." },
  "occurredAt": "2026-09-03T12:00:00.000Z"
}
```

Allowed event types: application created/call/accepted/rejected, rank changed, promotion created/accepted/rejected, AFK started/ended, vacation started/ended, balance changed, and system event. Metadata is small, typed, and rejects keys resembling secrets (`token`, `secret`, `password`, `authorization`, `cookie`).

## Historical mapping

No historical import runs in this stage. The public `Evrige/ravens-bot` reference has real persistent sources for applications, improvement/promotion requests, rank history, AFK records, vacation records, and balance-related activity. These map respectively to `APPLICATION_*`, `PROMOTION_*`, `RANK_CHANGED`, `AFK_*`, `VACATION_*`, and `BALANCE_CHANGED`. Its console `botLogger` output and aggregated voice counters are not business event history and are intentionally excluded.
