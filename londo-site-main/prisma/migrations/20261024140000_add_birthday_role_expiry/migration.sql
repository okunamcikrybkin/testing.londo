ALTER TABLE "users"
  ADD COLUMN "birthday_role_granted_at" TIMESTAMP(3);

CREATE INDEX "users_birthday_role_granted_at_idx"
  ON "users"("birthday_role_granted_at");
