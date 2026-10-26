-- Device identity replaces Discord login; groups get a short unique invite code.
-- D1 enforces foreign keys, so the table rebuilds rely on deferring the check to commit.
PRAGMA defer_foreign_keys = ON;

CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("createdAt", "id") SELECT "createdAt", "id" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";

CREATE TABLE "new_ServerGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServerGroup_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
-- Existing groups get a random 12-character hex code
INSERT INTO "new_ServerGroup" ("createdAt", "id", "name", "inviteCode", "ownerId")
SELECT "createdAt", "id", "name", upper(hex(randomblob(6))), "ownerId" FROM "ServerGroup";
DROP TABLE "ServerGroup";
ALTER TABLE "new_ServerGroup" RENAME TO "ServerGroup";
CREATE UNIQUE INDEX "ServerGroup_inviteCode_key" ON "ServerGroup"("inviteCode");

PRAGMA defer_foreign_keys = OFF;
