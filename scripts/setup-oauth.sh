#!/bin/bash

# OAuth Setup Helper Script
# This script helps you get Google OAuth credentials

echo "🔐 Google OAuth Setup Helper"
echo "============================"
echo ""
echo "This script will guide you through getting Google OAuth credentials."
echo ""

# Check if user wants to proceed
read -p "Do you have a Google Cloud account? (y/n): " has_account

if [ "$has_account" != "y" ]; then
    echo ""
    echo "📝 Steps to get Google OAuth credentials:"
    echo ""
    echo "1. Go to https://console.cloud.google.com/"
    echo "2. Sign in with your Google account"
    echo "3. Create a new project or select an existing one"
    echo "4. Enable Google+ API (if needed)"
    echo "5. Go to 'APIs & Services' > 'Credentials'"
    echo "6. Click 'Create Credentials' > 'OAuth client ID'"
    echo "7. Select 'Web application'"
    echo "8. Add authorized redirect URI: http://localhost:8787/oauth/google/callback"
    echo "9. Copy the Client ID and Client Secret"
    echo ""
    echo "Once you have the credentials, run this script again with 'y'"
    exit 0
fi

echo ""
echo "Please provide your Google OAuth credentials:"
echo ""

read -p "Google Client ID: " client_id
read -p "Google Client Secret: " client_secret

if [ -z "$client_id" ] || [ -z "$client_secret" ]; then
    echo "❌ Error: Both Client ID and Client Secret are required!"
    exit 1
fi

# Update wrangler.local.toml
CONFIG_FILE="backend/wrangler.local.toml"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Error: $CONFIG_FILE not found!"
    exit 1
fi

# Check if vars section exists
if grep -q "^\[vars\]" "$CONFIG_FILE"; then
    # Update existing vars
    if grep -q "GOOGLE_CLIENT_ID" "$CONFIG_FILE"; then
        # Update existing
        sed -i.bak "s|GOOGLE_CLIENT_ID = \".*\"|GOOGLE_CLIENT_ID = \"$client_id\"|" "$CONFIG_FILE"
        sed -i.bak "s|GOOGLE_CLIENT_SECRET = \".*\"|GOOGLE_CLIENT_SECRET = \"$client_secret\"|" "$CONFIG_FILE"
    else
        # Add to existing vars
        sed -i.bak "/^\[vars\]/a\\
GOOGLE_CLIENT_ID = \"$client_id\"\\
GOOGLE_CLIENT_SECRET = \"$client_secret\"
" "$CONFIG_FILE"
    fi
else
    # Add vars section
    echo "" >> "$CONFIG_FILE"
    echo "[vars]" >> "$CONFIG_FILE"
    echo "GOOGLE_CLIENT_ID = \"$client_id\"" >> "$CONFIG_FILE"
    echo "GOOGLE_CLIENT_SECRET = \"$client_secret\"" >> "$CONFIG_FILE"
fi

# Clean up backup file
rm -f "${CONFIG_FILE}.bak"

echo ""
echo "✅ Google OAuth credentials added to $CONFIG_FILE"
echo ""
echo "⚠️  Important: Make sure your Google OAuth redirect URI is set to:"
echo "   http://localhost:8787/oauth/google/callback"
echo ""
echo "🔄 Please restart your backend server for changes to take effect:"
echo "   cd backend && wrangler dev --port 8787 --local --config wrangler.local.toml"
echo ""

