#!/bin/bash

# Production Setup Script - Interactive
# This script guides you through setting up production resources

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Upto Production Setup${NC}"
echo ""

# Check wrangler
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler not found. Install: npm install -g wrangler${NC}"
    exit 1
fi

# Check login
if ! wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in. Please run: wrangler login${NC}"
    exit 1
fi

ACCOUNT=$(wrangler whoami 2>&1 | grep -oP 'email = "\K[^"]+' || echo "Unknown")
echo -e "${GREEN}✓ Logged in as: $ACCOUNT${NC}"
echo ""

# Step 1: D1 Database
echo -e "${BLUE}Step 1: Creating D1 Database...${NC}"
read -p "Create D1 database 'upto-db'? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    DB_OUTPUT=$(wrangler d1 create upto-db 2>&1)
    echo "$DB_OUTPUT"
    DB_ID=$(echo "$DB_OUTPUT" | grep -oP 'database_id = "\K[^"]+' || echo "")
    if [ ! -z "$DB_ID" ]; then
        echo -e "${GREEN}✓ Database ID: $DB_ID${NC}"
        echo -e "${YELLOW}⚠️  Please update backend/wrangler.toml with this database_id${NC}"
    fi
fi
echo ""

# Step 2: KV Namespaces
echo -e "${BLUE}Step 2: Creating KV Namespaces...${NC}"
for ns in STATUS_SNAPSHOTS STATUS_PAGE_CACHE RATE_LIMIT_STORE; do
    read -p "Create KV namespace '$ns'? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        KV_OUTPUT=$(wrangler kv:namespace create "$ns" 2>&1)
        echo "$KV_OUTPUT"
        KV_ID=$(echo "$KV_OUTPUT" | grep -oP 'id = "\K[^"]+' || echo "")
        if [ ! -z "$KV_ID" ]; then
            echo -e "${GREEN}✓ $ns ID: $KV_ID${NC}"
            echo -e "${YELLOW}⚠️  Please update backend/wrangler.toml with this id${NC}"
        fi
    fi
done
echo ""

# Step 3: Queue
echo -e "${BLUE}Step 3: Creating Queue...${NC}"
read -p "Create queue 'monitoring-queue'? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    wrangler queues create monitoring-queue 2>&1 || echo -e "${YELLOW}⚠️  Queue might already exist${NC}"
fi
echo ""

# Step 4: R2 Bucket
echo -e "${BLUE}Step 4: Creating R2 Bucket...${NC}"
read -p "Create R2 bucket 'upto-static-assets'? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    wrangler r2 bucket create upto-static-assets 2>&1 || echo -e "${YELLOW}⚠️  Bucket might already exist${NC}"
fi
echo ""

# Step 5: Secrets
echo -e "${BLUE}Step 5: Setting Secrets...${NC}"
echo -e "${YELLOW}You need to set these secrets manually:${NC}"
echo "  1. JWT_SECRET (strong random string)"
echo "  2. TELEGRAM_BOT_TOKEN (your bot token)"
echo "  3. ENCRYPTION_KEY (32 byte base64: openssl rand -base64 32)"
echo "  4. MAILCHANNELS_API_KEY (optional)"
echo ""
echo "Run these commands:"
echo "  wrangler secret put JWT_SECRET"
echo "  wrangler secret put TELEGRAM_BOT_TOKEN"
echo "  wrangler secret put ENCRYPTION_KEY"
echo "  wrangler secret put MAILCHANNELS_API_KEY"
echo ""

# Step 6: Migrations
echo -e "${BLUE}Step 6: Running Migrations...${NC}"
read -p "Run database migrations? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd ../infrastructure/migrations
    for migration in *.sql; do
        if [ -f "$migration" ]; then
            echo "Running: $migration"
            wrangler d1 execute upto-db --file="$migration" || echo -e "${YELLOW}⚠️  Migration might have errors (check manually)${NC}"
        fi
    done
    cd ../../backend
fi
echo ""

echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "Next: Update wrangler.toml with all IDs, then run: wrangler deploy"

