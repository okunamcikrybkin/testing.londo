ALTER TABLE "users"
  ADD COLUMN "birthday_month" INTEGER,
  ADD COLUMN "birthday_day" INTEGER,
  ADD COLUMN "birthday_last_celebrated_year" INTEGER;

CREATE INDEX "users_birthday_month_birthday_day_idx"
  ON "users"("birthday_month", "birthday_day");

ALTER TABLE "users"
  ADD CONSTRAINT "users_birthday_date_check"
  CHECK (
    ("birthday_month" IS NULL AND "birthday_day" IS NULL)
    OR (
      "birthday_month" BETWEEN 1 AND 12
      AND "birthday_day" BETWEEN 1 AND 31
    )
  );
