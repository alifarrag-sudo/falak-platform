#!/bin/bash
# FALAK Platform startup script
# Runs on every Render boot:
#   1. Apply is_demo migration (idempotent — safe to re-run)
#   2. Seed demo data if SEED_DEMO=true (INSERT OR IGNORE — safe to re-run)
#   3. Start the server
set -e

# Step 1: apply is_demo column migration against PostgreSQL
if [ -n "$DATABASE_URL" ]; then
  echo "🐘  Applying is_demo migration…"
  node backend/dist/scripts/apply-is-demo.js
fi

# Step 2: seed demo data
if [ "$SEED_DEMO" = "true" ]; then
  echo "🌱 Seeding demo data..."
  node backend/dist/scripts/seed-demo.js
  echo "✅ Demo seed complete"
fi

echo "🚀 Starting FALAK Platform..."
node backend/dist/index.js
