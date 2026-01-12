-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('public', 'private');

-- AlterTable
ALTER TABLE "Photo"
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "priceBySize" TEXT,
ADD COLUMN     "priceVisibility" "Visibility" NOT NULL DEFAULT 'public',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "descriptionVisibility" "Visibility" NOT NULL DEFAULT 'public';
