-- Add human-readable label + ordering/visibility to Tag.
-- Backwards compatible: keep existing column "name" as the stable key.

ALTER TABLE "Tag"
  ADD COLUMN IF NOT EXISTS "label" TEXT,
  ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill label for existing rows (convert kebab-case to spaced words).
UPDATE "Tag"
SET "label" = COALESCE("label", REPLACE("name", '-', ' ')),
    "updatedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP)
WHERE "label" IS NULL OR "label" = '';
