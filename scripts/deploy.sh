#!/bin/bash

# Quick Deployment Script
# This script helps with common deployment tasks

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Upto Deployment Helper${NC}"
echo ""

# Check if in backend directory
if [ ! -f "wrangler.toml" ]; then
    echo -e "${RED}❌ Please run this script from the backend directory${NC}"
    exit 1
fi

# Check wrangler
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler not found. Install: npm install -g wrangler${NC}"
    exit 1
fi

# Menu
echo "Select an action:"
echo "1) Check Cloudflare login"
echo "2) Create D1 Database"
echo "3) Create KV Namespaces"
echo "4) Create Queue"
echo "5) Create R2 Bucket"
echo "6) Set Secrets (interactive)"
echo "7) Run Migrations"
echo "8) Deploy Backend"
echo "9) Show current configuration"
echo ""
read -p "Choice (1-9): " choice

case $choice in
    1)
        echo -e "${BLUE}Checking login...${NC}"
        wrangler whoami
        ;;
    2)
        echo -e "${BLUE}Creating D1 database...${NC}"
        wrangler d1 create upto-db
        echo -e "${YELLOW}⚠️  Update wrangler.toml with the database_id${NC}"
        ;;
    3)
        echo -e "${BLUE}Creating KV namespaces...${NC}"
        for ns in STATUS_SNAPSHOTS STATUS_PAGE_CACHE RATE_LIMIT_STORE; do
            echo "Creating $ns..."
            wrangler kv:namespace create "$ns"
            echo -e "${YELLOW}⚠️  Update wrangler.toml with the id${NC}"
        done
        ;;
    4)
        echo -e "${BLUE}Creating queue...${NC}"
        wrangler queues create monitoring-queue
        ;;
    5)
        echo -e "${BLUE}Creating R2 bucket...${NC}"
        wrangler r2 bucket create upto-static-assets
        ;;
    6)
        echo -e "${BLUE}Setting secrets...${NC}"
        echo "You'll be prompted for each secret:"
        wrangler secret put JWT_SECRET
        wrangler secret put TELEGRAM_BOT_TOKEN
        wrangler secret put ENCRYPTION_KEY
        read -p "Set MAILCHANNELS_API_KEY? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            wrangler secret put MAILCHANNELS_API_KEY
        fi
        ;;
    7)
        echo -e "${BLUE}Running migrations...${NC}"
        cd ../infrastructure/migrations
        for migration in *.sql; do
            if [ -f "$migration" ]; then
                echo "Running: $migration"
                wrangler d1 execute upto-db --file="$migration" || echo -e "${YELLOW}⚠️  Error (might be already applied)${NC}"
            fi
        done
        cd ../../backend
        ;;
    8)
        echo -e "${BLUE}Deploying backend...${NC}"
        wrangler deploy
        echo -e "${GREEN}✅ Deployed!${NC}"
        ;;
    9)
        echo -e "${BLUE}Current configuration:${NC}"
        echo ""
        echo "D1 Database:"
        grep -A 2 "d1_databases" wrangler.toml | grep "database_id" || echo "  Not set"
        echo ""
        echo "KV Namespaces:"
        grep -A 1 "kv_namespaces" wrangler.toml | grep "id" || echo "  Not set"
        echo ""
        echo "Secrets:"
        wrangler secret list 2>/dev/null || echo "  Run 'wrangler secret list' to see secrets"
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac
