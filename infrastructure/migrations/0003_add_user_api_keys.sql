-- Migration: Add user_api_keys table for managing API keys from UI
-- This allows users to configure their own API keys (e.g., OpenAI) from the interface

CREATE TABLE IF NOT EXISTS user_api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  api_provider TEXT NOT NULL CHECK(api_provider IN ('openai', 'anthropic', 'google', 'azure')),
  api_key_encrypted TEXT NOT NULL, -- Encrypted API key (in production, use proper encryption)
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, api_provider)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_provider ON user_api_keys(api_provider);

