UPDATE "family_memberships"
SET "active" = FALSE,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "family" = 'PHOENIX' AND "active" = TRUE;
