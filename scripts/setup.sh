#!/bin/bash

# Upto Cloudflare Setup Script
# This script helps set up the development environment

set -e

echo "🚀 Setting up Upto Cloudflare project..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Installing..."
    npm install -g wrangler
fi

# Backend setup
echo "📦 Setting up backend..."
cd backend
npm install
cd ..

# Frontend setup
echo "📦 Setting up frontend..."
cd frontend
npm install
cd ..

# Create D1 database
echo "🗄️  Creating D1 database..."
cd backend
wrangler d1 create upto-db || echo "Database might already exist"
wrangler d1 create upto-db-dev || echo "Dev database might already exist"
cd ..

# Create KV namespaces
echo "💾 Creating KV namespaces..."
cd backend
wrangler kv:namespace create STATUS_SNAPSHOTS || echo "KV namespace might already exist"
wrangler kv:namespace create STATUS_PAGE_CACHE || echo "KV namespace might already exist"
cd ..

# Create R2 bucket
echo "🪣 Creating R2 bucket..."
cd backend
wrangler r2 bucket create upto-static-assets || echo "R2 bucket might already exist"
cd ..

# Create Queue
echo "📬 Creating Queue..."
cd backend
wrangler queues create monitoring-queue || echo "Queue might already exist"
cd ..

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update wrangler.toml with the IDs from the commands above"
echo "2. Set secrets: wrangler secret put JWT_SECRET"
echo "3. Set secrets: wrangler secret put TELEGRAM_BOT_TOKEN (optional)"
echo "4. Set secrets: wrangler secret put MAILCHANNELS_API_KEY (optional)"
echo "5. Run migrations: cd backend && npm run migrate:dev"
echo "6. Start dev server: cd backend && npm run dev"

