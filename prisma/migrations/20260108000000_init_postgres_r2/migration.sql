-- Prisma migration for Postgres (Cloudflare R2 version)

-- Create enum
CREATE TYPE "JobStatus" AS ENUM ('queued', 'processing', 'done', 'failed');

-- Create Photo table
CREATE TABLE "Photo" (
  "id" TEXT NOT NULL,
  "originalKey" TEXT,
  "displayKey" TEXT NOT NULL,
  "thumbKey" TEXT NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "aiCategory" TEXT,
  "aiConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "userCategory" TEXT,
  "finalCategory" TEXT NOT NULL DEFAULT 'uncategorized',
  "adminNote" TEXT,
  "adminNotePublic" BOOLEAN NOT NULL DEFAULT false,
  "adminSourceUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Photo_displayKey_key" ON "Photo"("displayKey");
CREATE UNIQUE INDEX "Photo_thumbKey_key" ON "Photo"("thumbKey");
CREATE INDEX "Photo_finalCategory_idx" ON "Photo"("finalCategory");
CREATE INDEX "Photo_createdAt_idx" ON "Photo"("createdAt");

-- Create Tag table
CREATE TABLE "Tag" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");
CREATE INDEX "Tag_name_idx" ON "Tag"("name");

-- Implicit many-to-many join table
CREATE TABLE "_PhotoToTag" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);

CREATE UNIQUE INDEX "_PhotoToTag_AB_unique" ON "_PhotoToTag"("A", "B");
CREATE INDEX "_PhotoToTag_B_index" ON "_PhotoToTag"("B");

ALTER TABLE "_PhotoToTag"
ADD CONSTRAINT "_PhotoToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_PhotoToTag"
ADD CONSTRAINT "_PhotoToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Comments
CREATE TABLE "Comment" (
  "id" TEXT NOT NULL,
  "photoId" TEXT NOT NULL,
  "authorName" TEXT NOT NULL DEFAULT 'Ẩn danh',
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Comment_photoId_createdAt_idx" ON "Comment"("photoId", "createdAt");

ALTER TABLE "Comment"
ADD CONSTRAINT "Comment_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Jobs
CREATE TABLE "ClassificationJob" (
  "id" TEXT NOT NULL,
  "photoId" TEXT NOT NULL,
  "status" "JobStatus" NOT NULL DEFAULT 'queued',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "lockedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClassificationJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClassificationJob_photoId_key" ON "ClassificationJob"("photoId");
CREATE INDEX "ClassificationJob_status_lockedAt_idx" ON "ClassificationJob"("status", "lockedAt");

ALTER TABLE "ClassificationJob"
ADD CONSTRAINT "ClassificationJob_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
