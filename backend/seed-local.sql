-- Local seed data with proper password hash
-- Password: password123
-- Hash: SHA-256 hash of 'password123'

-- Default admin user
INSERT OR IGNORE INTO users (id, email, password_hash, name, role) VALUES
  ('admin-001', 'admin@upto.dev', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'Admin User', 'admin');

-- Default test user
INSERT OR IGNORE INTO users (id, email, password_hash, name, role) VALUES
  ('user-001', 'user@upto.dev', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'Test User', 'user');

-- Sample integrations
INSERT OR IGNORE INTO integrations (id, user_id, email_address, is_active) VALUES
  ('integration-001', 'user-001', 'user@upto.dev', 1);

