-- Seed data for development/testing
-- Note: Password hash is for 'password123' (bcrypt hash)
-- In production, use proper password hashing

-- Default admin user
INSERT OR IGNORE INTO users (id, email, password_hash, name, role) VALUES
  ('admin-001', 'admin@upto.dev', '$2b$10$rOzJqJqJqJqJqJqJqJqJqOqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJq', 'Admin User', 'admin');

-- Default test user
INSERT OR IGNORE INTO users (id, email, password_hash, name, role) VALUES
  ('user-001', 'user@upto.dev', '$2b$10$rOzJqJqJqJqJqJqJqJqJqOqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJq', 'Test User', 'user');

-- Sample integrations
INSERT OR IGNORE INTO integrations (id, user_id, email_address, is_active) VALUES
  ('integration-001', 'user-001', 'user@upto.dev', 1);

