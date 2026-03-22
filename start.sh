#!/bin/bash
# FALAK Platform startup script
# If SEED_DEMO=true, seed demo data before starting the server (safe to re-run — uses INSERT OR IGNORE)
set -e

if [ "$SEED_DEMO" = "true" ]; then
  echo "🌱 Seeding demo data..."
  node backend/dist/scripts/seed-demo.js
  echo "✅ Demo seed complete"
fi

echo "🚀 Starting FALAK Platform..."
node backend/dist/index.js
