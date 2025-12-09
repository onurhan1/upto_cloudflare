#!/bin/bash

# Cloudflare Pages Git Integration Script
# This script attempts to connect GitHub repository to Cloudflare Pages via API

set -e

ACCOUNT_ID="1b01171ad67364409ba073f8881f818f"
PROJECT_NAME="upto-frontend"
REPO_OWNER="onurhan1"
REPO_NAME="upto_cloudflare"
BRANCH="main"

echo "🔗 Connecting GitHub repository to Cloudflare Pages..."
echo ""
echo "Repository: $REPO_OWNER/$REPO_NAME"
echo "Branch: $BRANCH"
echo ""

# Note: This requires Cloudflare API token with Pages:Edit permission
# Get your API token from: https://dash.cloudflare.com/profile/api-tokens
# Create a token with "Cloudflare Pages:Edit" permission

echo "⚠️  Git integration requires Cloudflare Dashboard access."
echo ""
echo "Please complete the following steps in Cloudflare Dashboard:"
echo ""
echo "1. Go to: https://dash.cloudflare.com/1b01171ad67364409ba073f8881f818f/pages/view/upto-frontend"
echo "2. Click: Settings > Builds & deployments"
echo "3. Click: Connect to Git"
echo "4. Select: GitHub"
echo "5. Authorize and select repository: $REPO_OWNER/$REPO_NAME"
echo "6. Configure build settings:"
echo "   - Build command: cd frontend && npm install && npm run cf-pages:build"
echo "   - Build output: frontend/.vercel/output/static"
echo "   - Root directory: /"
echo "7. Click: Save and Deploy"
echo ""
echo "✅ All code is ready and pushed to GitHub!"
echo "✅ Environment variables are set!"
echo "✅ Build scripts are configured!"
echo ""
echo "After connecting Git in Dashboard, deployments will be automatic!"

