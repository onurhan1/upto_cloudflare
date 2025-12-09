#!/bin/bash

# Upto Production Deployment Script
# This script automates the deployment process to Cloudflare

set -e  # Exit on error

echo "🚀 Starting Upto Production Deployment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler CLI not found. Please install it: npm install -g wrangler${NC}"
    exit 1
fi

# Check if logged in
if ! wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Cloudflare. Please run: wrangler login${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Wrangler CLI found and logged in${NC}"
echo ""

# Navigate to backend directory
cd "$(dirname "$0")/../backend"

echo "📦 Step 1: Creating D1 Database..."
DB_OUTPUT=$(wrangler d1 create upto-db 2>&1)
DB_ID=$(echo "$DB_OUTPUT" | grep -oP 'database_id = "\K[^"]+' || echo "")
if [ -z "$DB_ID" ]; then
    echo -e "${YELLOW}⚠️  Database might already exist. Checking existing databases...${NC}"
    wrangler d1 list
    echo -e "${YELLOW}Please manually update wrangler.toml with the correct database_id${NC}"
else
    echo -e "${GREEN}✓ Database created with ID: $DB_ID${NC}"
    # Update wrangler.toml with database_id
    sed -i.bak "s/database_id = \"\"/database_id = \"$DB_ID\"/" wrangler.toml
    echo -e "${GREEN}✓ Updated wrangler.toml with database_id${NC}"
fi
echo ""

echo "📦 Step 2: Creating KV Namespaces..."
# STATUS_SNAPSHOTS
KV1_OUTPUT=$(wrangler kv:namespace create STATUS_SNAPSHOTS 2>&1)
KV1_ID=$(echo "$KV1_OUTPUT" | grep -oP 'id = "\K[^"]+' || echo "")
if [ ! -z "$KV1_ID" ]; then
    sed -i.bak "s/binding = \"STATUS_SNAPSHOTS\"/binding = \"STATUS_SNAPSHOTS\"\nid = \"$KV1_ID\"/" wrangler.toml
    echo -e "${GREEN}✓ STATUS_SNAPSHOTS created: $KV1_ID${NC}"
fi

# STATUS_PAGE_CACHE
KV2_OUTPUT=$(wrangler kv:namespace create STATUS_PAGE_CACHE 2>&1)
KV2_ID=$(echo "$KV2_OUTPUT" | grep -oP 'id = "\K[^"]+' || echo "")
if [ ! -z "$KV2_ID" ]; then
    sed -i.bak "s/binding = \"STATUS_PAGE_CACHE\"/binding = \"STATUS_PAGE_CACHE\"\nid = \"$KV2_ID\"/" wrangler.toml
    echo -e "${GREEN}✓ STATUS_PAGE_CACHE created: $KV2_ID${NC}"
fi

# RATE_LIMIT_STORE
KV3_OUTPUT=$(wrangler kv:namespace create RATE_LIMIT_STORE 2>&1)
KV3_ID=$(echo "$KV3_OUTPUT" | grep -oP 'id = "\K[^"]+' || echo "")
if [ ! -z "$KV3_ID" ]; then
    # Add to wrangler.toml
    echo "" >> wrangler.toml
    echo "[[kv_namespaces]]" >> wrangler.toml
    echo "binding = \"RATE_LIMIT_STORE\"" >> wrangler.toml
    echo "id = \"$KV3_ID\"" >> wrangler.toml
    echo -e "${GREEN}✓ RATE_LIMIT_STORE created: $KV3_ID${NC}"
fi
echo ""

echo "📦 Step 3: Creating Queue..."
QUEUE_OUTPUT=$(wrangler queues create monitoring-queue 2>&1)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Queue created${NC}"
else
    echo -e "${YELLOW}⚠️  Queue might already exist${NC}"
fi
echo ""

echo "📦 Step 4: Creating R2 Bucket..."
R2_OUTPUT=$(wrangler r2 bucket create upto-static-assets 2>&1)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ R2 bucket created${NC}"
else
    echo -e "${YELLOW}⚠️  R2 bucket might already exist${NC}"
fi
echo ""

echo "📦 Step 5: Running Migrations..."
cd ../infrastructure/migrations
for migration in 0001_initial_schema.sql 0002_add_anomaly_and_ai.sql 0003_add_user_api_keys.sql 0004_add_multitenancy.sql 0005_add_audit_logs.sql 0006_query_optimization.sql; do
    if [ -f "$migration" ]; then
        echo "Running migration: $migration"
        wrangler d1 execute upto-db --file="$migration" || echo -e "${YELLOW}⚠️  Migration might have already been applied${NC}"
    fi
done
cd ../../backend
echo ""

echo "🔐 Step 6: Setting Secrets..."
echo -e "${YELLOW}You need to set the following secrets manually:${NC}"
echo "  - wrangler secret put JWT_SECRET"
echo "  - wrangler secret put TELEGRAM_BOT_TOKEN"
echo "  - wrangler secret put ENCRYPTION_KEY"
echo "  - wrangler secret put MAILCHANNELS_API_KEY (optional)"
echo ""
read -p "Have you set all required secrets? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⚠️  Please set secrets before deploying${NC}"
    exit 1
fi
echo ""

echo "🚀 Step 7: Deploying Backend Worker..."
wrangler deploy
echo ""

echo -e "${GREEN}✅ Backend deployment completed!${NC}"
echo ""
echo "📝 Next Steps:"
echo "  1. Update frontend/.env with NEXT_PUBLIC_API_URL"
echo "  2. Build frontend: cd frontend && npm run build"
echo "  3. Deploy frontend to Cloudflare Pages"
echo "  4. Update FRONTEND_URL in wrangler.toml"
echo "  5. Redeploy backend if needed"
echo ""

