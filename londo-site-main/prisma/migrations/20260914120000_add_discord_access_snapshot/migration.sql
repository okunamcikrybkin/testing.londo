CREATE TABLE "user_access_snapshots" (
    "user_id" TEXT NOT NULL,
    "memphis_role" "UserRole" NOT NULL DEFAULT 'USER',
    "phoenix_role" "UserRole" NOT NULL DEFAULT 'USER',
    "observed_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_access_snapshots_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "user_access_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
