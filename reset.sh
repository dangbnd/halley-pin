#!/usr/bin/env bash
set -euo pipefail

rm -rf .next node_modules node_modules/.prisma prisma/dev.db

npm install
npx prisma generate
npx prisma migrate dev

echo "\nDone. Run: npm run dev"
