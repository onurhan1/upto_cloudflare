#!/bin/bash
# Run migration 0002_add_anomaly_and_ai.sql

echo "Running migration 0002_add_anomaly_and_ai.sql..."

cd "$(dirname "$0")/../backend"

# For local development, you can run the SQL directly
# First, let's check if we can connect to the database
echo "Note: This migration adds:"
echo "  - anomaly_detected, anomaly_type, anomaly_score to service_checks table"
echo "  - ai_summary to incidents table"
echo ""
echo "To run this migration manually:"
echo "1. Start your backend with: cd backend && npx wrangler dev --local-env"
echo "2. In another terminal, connect to the database and run:"
echo ""
echo "ALTER TABLE service_checks ADD COLUMN anomaly_detected INTEGER NOT NULL DEFAULT 0;"
echo "ALTER TABLE service_checks ADD COLUMN anomaly_type TEXT CHECK(anomaly_type IN ('spike', 'slowdown', 'unknown'));"
echo "ALTER TABLE service_checks ADD COLUMN anomaly_score REAL;"
echo "ALTER TABLE incidents ADD COLUMN ai_summary TEXT;"
echo ""
echo "Or use wrangler d1 execute (if database is created):"
echo "npx wrangler d1 execute upto-db-dev --local --file=../infrastructure/migrations/0002_add_anomaly_and_ai.sql"

