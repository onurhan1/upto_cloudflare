// Database migration utilities
// Automatically runs pending migrations on startup

import { Env } from '../types';

interface Migration {
  version: number;
  name: string;
  sql: string;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    sql: `
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user', 'readonly')),
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      );

      -- Monitored services table
      CREATE TABLE IF NOT EXISTS monitored_services (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('http', 'ping', 'dns', 'ssl', 'domain', 'api')),
        url_or_host TEXT NOT NULL,
        port INTEGER,
        check_interval_seconds INTEGER NOT NULL DEFAULT 60,
        timeout_ms INTEGER NOT NULL DEFAULT 5000,
        expected_status_code INTEGER,
        expected_keyword TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        notify_telegram INTEGER NOT NULL DEFAULT 0,
        notify_email INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Service checks table (health check results)
      CREATE TABLE IF NOT EXISTS service_checks (
        id TEXT PRIMARY KEY,
        service_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('up', 'down', 'degraded')),
        response_time_ms INTEGER,
        status_code INTEGER,
        error_message TEXT,
        checked_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (service_id) REFERENCES monitored_services(id) ON DELETE CASCADE
      );

      -- Incidents table
      CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY,
        service_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'monitoring', 'resolved')),
        title TEXT NOT NULL,
        description TEXT,
        started_at INTEGER NOT NULL DEFAULT (unixepoch()),
        resolved_at INTEGER,
        created_by TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (service_id) REFERENCES monitored_services(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      );

      -- Incident updates table
      CREATE TABLE IF NOT EXISTS incident_updates (
        id TEXT PRIMARY KEY,
        incident_id TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('investigating', 'identified', 'monitoring', 'resolved')),
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
      );

      -- Integrations table (Telegram, Email settings)
      CREATE TABLE IF NOT EXISTS integrations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        telegram_chat_id TEXT,
        email_address TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id)
      );

      -- Status pages table
      CREATE TABLE IF NOT EXISTS status_pages (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        is_public INTEGER NOT NULL DEFAULT 0,
        theme TEXT NOT NULL DEFAULT 'auto' CHECK(theme IN ('light', 'dark', 'auto')),
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Status page services (many-to-many relationship)
      CREATE TABLE IF NOT EXISTS status_page_services (
        id TEXT PRIMARY KEY,
        status_page_id TEXT NOT NULL,
        service_id TEXT NOT NULL,
        display_order INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (status_page_id) REFERENCES status_pages(id) ON DELETE CASCADE,
        FOREIGN KEY (service_id) REFERENCES monitored_services(id) ON DELETE CASCADE,
        UNIQUE(status_page_id, service_id)
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_monitored_services_user_id ON monitored_services(user_id);
      CREATE INDEX IF NOT EXISTS idx_monitored_services_is_active ON monitored_services(is_active);
      CREATE INDEX IF NOT EXISTS idx_service_checks_service_id ON service_checks(service_id);
      CREATE INDEX IF NOT EXISTS idx_service_checks_checked_at ON service_checks(checked_at DESC);
      CREATE INDEX IF NOT EXISTS idx_incidents_service_id ON incidents(service_id);
      CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
      CREATE INDEX IF NOT EXISTS idx_incident_updates_incident_id ON incident_updates(incident_id);
      CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON integrations(user_id);
      CREATE INDEX IF NOT EXISTS idx_status_pages_slug ON status_pages(slug);
      CREATE INDEX IF NOT EXISTS idx_status_page_services_status_page_id ON status_page_services(status_page_id);
    `,
  },
  {
    version: 2,
    name: 'add_anomaly_and_ai',
    sql: `
      -- Add anomaly detection fields to service_checks table
      -- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
      -- We'll handle this in the application code
      
      -- Check and add anomaly_detected column
      -- Check and add anomaly_type column  
      -- Check and add anomaly_score column
      -- Check and add ai_summary column
    `,
  },
  {
    version: 3,
    name: 'add_user_api_keys',
    sql: `
      CREATE TABLE IF NOT EXISTS user_api_keys (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        api_provider TEXT NOT NULL CHECK(api_provider IN ('openai', 'anthropic', 'google', 'azure')),
        api_key_encrypted TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, api_provider)
      );
      
      CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_api_keys_provider ON user_api_keys(api_provider);
    `,
  },
  {
    version: 4,
    name: 'add_multitenancy',
    sql: `
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
      
      CREATE TABLE IF NOT EXISTS organization_members (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner', 'admin', 'member', 'viewer')),
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(organization_id, user_id)
      );
      
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
      );
      
      CREATE TABLE IF NOT EXISTS project_services (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        service_id TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (service_id) REFERENCES monitored_services(id) ON DELETE CASCADE,
        UNIQUE(project_id, service_id)
      );
      
      CREATE TABLE IF NOT EXISTS organization_invitations (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner', 'admin', 'member', 'viewer')),
        token TEXT UNIQUE NOT NULL,
        invited_by TEXT,
        expires_at INTEGER NOT NULL,
        accepted_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
      CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON organization_members(organization_id);
      CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_projects_org_id ON projects(organization_id);
      CREATE INDEX IF NOT EXISTS idx_project_services_project_id ON project_services(project_id);
      CREATE INDEX IF NOT EXISTS idx_project_services_service_id ON project_services(service_id);
      CREATE INDEX IF NOT EXISTS idx_organization_invitations_token ON organization_invitations(token);
      CREATE INDEX IF NOT EXISTS idx_organization_invitations_org_id ON organization_invitations(organization_id);
    `,
  },
  {
    version: 6,
    name: 'query_optimization',
    sql: `
      -- Composite index for service_checks: service_id + checked_at (for ORDER BY queries)
      CREATE INDEX IF NOT EXISTS idx_service_checks_service_checked 
      ON service_checks(service_id, checked_at DESC);
      
      -- Composite index for service_checks: service_id + status + response_time_ms (for anomaly detection)
      CREATE INDEX IF NOT EXISTS idx_service_checks_service_status_response 
      ON service_checks(service_id, status, response_time_ms) 
      WHERE response_time_ms IS NOT NULL AND status = 'up';
      
      -- Composite index for incidents: service_id + status + started_at (for filtering and sorting)
      CREATE INDEX IF NOT EXISTS idx_incidents_service_status_started 
      ON incidents(service_id, status, started_at DESC);
      
      -- Index for monitored_services: organization_id + is_active (for filtering active services by org)
      CREATE INDEX IF NOT EXISTS idx_monitored_services_org_active 
      ON monitored_services(organization_id, is_active) 
      WHERE is_active = 1;
      
      -- Index for monitored_services: project_id + is_active (for filtering active services by project)
      CREATE INDEX IF NOT EXISTS idx_monitored_services_project_active 
      ON monitored_services(project_id, is_active) 
      WHERE is_active = 1;
      
      -- Composite index for incidents with organization scope (for multitenancy)
      CREATE INDEX IF NOT EXISTS idx_incidents_service_started 
      ON incidents(service_id, started_at DESC);
    `,
  },
  {
    version: 5,
    name: 'add_audit_logs',
    sql: `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        organization_id TEXT,
        action TEXT NOT NULL,
        resource_type TEXT,
        resource_id TEXT,
        metadata TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON audit_logs(organization_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_org_action ON audit_logs(user_id, organization_id, action);
    `,
  },
];

/**
 * Check if a migration has been applied
 */
async function isMigrationApplied(db: D1Database, version: number): Promise<boolean> {
  try {
    // Check if migrations table exists
    const tableCheck = await db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'")
      .first();

    if (!tableCheck) {
      // Create migrations table
      await db
        .prepare(
          `CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at INTEGER NOT NULL DEFAULT (unixepoch())
          )`
        )
        .run();
      return false;
    }

    // Check if this migration is already applied
    const migration = await db
      .prepare('SELECT version FROM schema_migrations WHERE version = ?')
      .bind(version)
      .first();

    return !!migration;
  } catch (error) {
    console.error('Error checking migration status:', error);
    return false;
  }
}

/**
 * Check if a column exists in a table
 */
async function columnExists(db: D1Database, tableName: string, columnName: string): Promise<boolean> {
  try {
    const result = await db
      .prepare(`PRAGMA table_info(${tableName})`)
      .all<{ name: string }>();

    return (result.results || []).some((col) => col.name === columnName);
  } catch (error) {
    console.error(`Error checking column ${columnName} in ${tableName}:`, error);
    return false;
  }
}

/**
 * Apply a migration
 */
async function applyMigration(db: D1Database, migration: Migration): Promise<void> {
  try {
    console.log(`Applying migration ${migration.version}: ${migration.name}`);

    // Handle migration 1: Initial schema
    if (migration.version === 1) {
      // Check if schema_migrations table exists, if not create it
      const schemaTableCheck = await db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'")
        .first();
      
      if (!schemaTableCheck) {
        await db.prepare(`
          CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at INTEGER NOT NULL DEFAULT (unixepoch())
          )
        `).run();
        console.log('  ✓ Created schema_migrations table');
      }

      // Check if users table already exists (migration already applied)
      const usersTableCheck = await db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        .first();
      
      if (usersTableCheck) {
        console.log('  ✓ Initial schema already exists, skipping');
        return;
      }

      // Apply the SQL statements in order
      // Manually parse SQL to handle multi-line CREATE statements correctly
      const sql = migration.sql.trim();
      
      // Remove comments and split by semicolon
      const lines = sql.split('\n');
      let currentStatement = '';
      const statements: string[] = [];
      
      for (const line of lines) {
        const trimmed = line.trim();
        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('--')) {
          continue;
        }
        
        currentStatement += (currentStatement ? ' ' : '') + trimmed;
        
        // If line ends with semicolon, we have a complete statement
        if (trimmed.endsWith(';')) {
          statements.push(currentStatement.slice(0, -1)); // Remove trailing semicolon
          currentStatement = '';
        }
      }
      
      // Execute statements one by one in order
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i].trim();
        if (!statement) continue;
        
        try {
          await db.prepare(statement).run();
          
          // Log table creation
          const tableMatch = statement.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
          if (tableMatch) {
            console.log(`  ✓ Created table: ${tableMatch[1]}`);
          }
        } catch (error: any) {
          if (error.message?.includes('duplicate') || error.message?.includes('already exists')) {
            console.log(`  Skipping statement ${i + 1} (already exists)`);
            continue;
          }
          console.error(`  Error executing statement ${i + 1}: ${statement.substring(0, 100)}...`);
          console.error(`  Full error: ${error.message}`);
          throw error;
        }
      }
      console.log('  ✓ Applied initial schema migration');
    } else if (migration.version === 2) {
      // Add anomaly_detected to service_checks
      if (!(await columnExists(db, 'service_checks', 'anomaly_detected'))) {
        await db.prepare('ALTER TABLE service_checks ADD COLUMN anomaly_detected INTEGER NOT NULL DEFAULT 0').run();
        console.log('  ✓ Added anomaly_detected column to service_checks');
      }

      // Add anomaly_type to service_checks
      if (!(await columnExists(db, 'service_checks', 'anomaly_type'))) {
        await db.prepare("ALTER TABLE service_checks ADD COLUMN anomaly_type TEXT CHECK(anomaly_type IN ('spike', 'slowdown', 'unknown'))").run();
        console.log('  ✓ Added anomaly_type column to service_checks');
      }

      // Add anomaly_score to service_checks
      if (!(await columnExists(db, 'service_checks', 'anomaly_score'))) {
        await db.prepare('ALTER TABLE service_checks ADD COLUMN anomaly_score REAL').run();
        console.log('  ✓ Added anomaly_score column to service_checks');
      }

      // Add ai_summary to incidents
      if (!(await columnExists(db, 'incidents', 'ai_summary'))) {
        await db.prepare('ALTER TABLE incidents ADD COLUMN ai_summary TEXT').run();
        console.log('  ✓ Added ai_summary column to incidents');
      }
    } else if (migration.version === 3) {
      // Handle migration 3: Add user_api_keys table
      const tableCheck = await db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_api_keys'")
        .first();
      
      if (!tableCheck) {
        // Apply the SQL statements
        const statements = migration.sql
          .split(';')
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
          if (statement.trim()) {
            try {
              await db.prepare(statement).run();
            } catch (error: any) {
              if (error.message?.includes('duplicate') || error.message?.includes('already exists')) {
                console.log(`  Skipping: ${statement.substring(0, 50)}... (already exists)`);
                continue;
              }
              throw error;
            }
          }
        }
        console.log('  ✓ Created user_api_keys table');
      } else {
        console.log('  ✓ user_api_keys table already exists');
      }
    } else if (migration.version === 4) {
      // Handle migration 4: Add multitenancy tables
      // Check each table individually to ensure all are created
      const tablesToCheck = [
        'organizations',
        'organization_members',
        'projects',
        'project_services',
        'organization_invitations',
      ];
      
      const existingTables = await db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all<{ name: string }>();
      
      const existingTableNames = (existingTables.results || []).map((t) => t.name);
      const missingTables = tablesToCheck.filter((t) => !existingTableNames.includes(t));
      
      if (missingTables.length > 0 || !existingTableNames.includes('organizations')) {
        // Apply the SQL statements
        const statements = migration.sql
          .split(';')
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
          if (statement.trim()) {
            try {
              await db.prepare(statement).run();
            } catch (error: any) {
              if (error.message?.includes('duplicate') || error.message?.includes('already exists')) {
                console.log(`  Skipping: ${statement.substring(0, 50)}... (already exists)`);
                continue;
              }
              throw error;
            }
          }
        }
        console.log('  ✓ Created/verified multitenancy tables');
      } else {
        console.log('  ✓ Multitenancy tables already exist');
      }
      
      // Always check and add organization_id and project_id columns to monitored_services
      // This is important even if tables already exist (columns might be missing)
      try {
        const columnCheck = await db
          .prepare("PRAGMA table_info(monitored_services)")
          .all<{ name: string }>();
        
        const hasOrgId = (columnCheck.results || []).some((col) => col.name === 'organization_id');
        const hasProjectId = (columnCheck.results || []).some((col) => col.name === 'project_id');
        
        if (!hasOrgId) {
          await db.prepare('ALTER TABLE monitored_services ADD COLUMN organization_id TEXT').run();
          console.log('  ✓ Added organization_id column to monitored_services');
        } else {
          console.log('  ✓ organization_id column already exists');
        }
        
        if (!hasProjectId) {
          await db.prepare('ALTER TABLE monitored_services ADD COLUMN project_id TEXT').run();
          console.log('  ✓ Added project_id column to monitored_services');
        } else {
          console.log('  ✓ project_id column already exists');
        }
      } catch (colError: any) {
        // If monitored_services table doesn't exist, that's okay
        if (!colError.message?.includes('no such table')) {
          console.error('  ⚠ Error checking/adding columns:', colError.message);
        }
      }

      // Always verify projects and project_services tables exist (even if migration was applied)
      // This ensures tables are created even if migration was partially applied
      try {
        const projectsTableCheck = await db
          .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'")
          .first();
        
        if (!projectsTableCheck) {
          // Create projects table
          await db.prepare(`
            CREATE TABLE IF NOT EXISTS projects (
              id TEXT PRIMARY KEY,
              organization_id TEXT NOT NULL,
              name TEXT NOT NULL,
              description TEXT,
              created_at INTEGER NOT NULL DEFAULT (unixepoch()),
              updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
              FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
            )
          `).run();
          console.log('  ✓ Created projects table (on-the-fly)');
        }

        const projectServicesTableCheck = await db
          .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='project_services'")
          .first();
        
        if (!projectServicesTableCheck) {
          // Create project_services table
          await db.prepare(`
            CREATE TABLE IF NOT EXISTS project_services (
              id TEXT PRIMARY KEY,
              project_id TEXT NOT NULL,
              service_id TEXT NOT NULL,
              created_at INTEGER NOT NULL DEFAULT (unixepoch()),
              FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
              FOREIGN KEY (service_id) REFERENCES monitored_services(id) ON DELETE CASCADE,
              UNIQUE(project_id, service_id)
            )
          `).run();
          console.log('  ✓ Created project_services table (on-the-fly)');
        }
      } catch (tableError: any) {
        console.error('  ⚠ Error creating projects tables:', tableError.message);
      }
    } else {
      // For other migrations, use the SQL directly
      const statements = migration.sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await db.prepare(statement).run();
          } catch (error: any) {
            // Ignore "duplicate column" errors
            if (error.message?.includes('duplicate column') || error.message?.includes('already exists')) {
              console.log(`  Skipping: ${statement.substring(0, 50)}... (already exists)`);
              continue;
            }
            throw error;
          }
        }
      }
    }

    // Record migration
    const now = Math.floor(Date.now() / 1000);
    try {
      // Check if schema_migrations table has 'name' column
      const tableInfo = await db.prepare("PRAGMA table_info(schema_migrations)").all<{ name: string }>();
      const hasNameColumn = (tableInfo.results || []).some((col) => col.name === 'name');
      
      if (hasNameColumn) {
        await db
          .prepare('INSERT OR IGNORE INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
          .bind(migration.version, migration.name, now)
          .run();
      } else {
        await db
          .prepare('INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)')
          .bind(migration.version, now)
          .run();
      }
    } catch (error: any) {
      // If schema_migrations table doesn't exist, create it
      if (error.message?.includes('no such table')) {
        await db.prepare(`
          CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at INTEGER NOT NULL DEFAULT (unixepoch())
          )
        `).run();
        await db
          .prepare('INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)')
          .bind(migration.version, now)
          .run();
      } else {
        throw error;
      }
    }

    console.log(`✓ Migration ${migration.version} applied successfully`);
  } catch (error) {
    console.error(`✗ Error applying migration ${migration.version}:`, error);
    throw error;
  }
}

/**
 * Run all pending migrations
 */
export async function runMigrations(env: Env): Promise<void> {
  const db = env.DB;

  try {
    console.log('Checking for pending migrations...');

    // Special handling: Always check and add columns for migration 4 (even if migration is applied)
    // This ensures backward compatibility
    try {
      const columnCheck = await db
        .prepare("PRAGMA table_info(monitored_services)")
        .all<{ name: string }>();
      
      const hasOrgId = (columnCheck.results || []).some((col) => col.name === 'organization_id');
      const hasProjectId = (columnCheck.results || []).some((col) => col.name === 'project_id');
      
      if (!hasOrgId) {
        await db.prepare('ALTER TABLE monitored_services ADD COLUMN organization_id TEXT').run();
        console.log('  ✓ Added organization_id column to monitored_services');
      }
      
      if (!hasProjectId) {
        await db.prepare('ALTER TABLE monitored_services ADD COLUMN project_id TEXT').run();
        console.log('  ✓ Added project_id column to monitored_services');
      }
    } catch (colError: any) {
      if (!colError.message?.includes('no such table')) {
        console.warn('  ⚠ Could not check/add columns (table may not exist yet):', colError.message);
      }
    }

    // Ensure migrations table exists
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at INTEGER NOT NULL DEFAULT (unixepoch())
        )`
      )
      .run();

    // Get current migration version
    const currentVersion = await db
      .prepare('SELECT MAX(version) as max_version FROM schema_migrations')
      .first<{ max_version: number | null }>();

    const lastAppliedVersion = currentVersion?.max_version || 0;

    // Find pending migrations
    const pendingMigrations = MIGRATIONS.filter((m) => m.version > lastAppliedVersion);

    if (pendingMigrations.length === 0) {
      console.log('✓ No pending migrations');
      return;
    }

    console.log(`Found ${pendingMigrations.length} pending migration(s)`);

    // Apply each pending migration in order
    for (const migration of pendingMigrations) {
      const isApplied = await isMigrationApplied(db, migration.version);
      if (!isApplied) {
        await applyMigration(db, migration);
      } else {
        console.log(`  Migration ${migration.version} already applied, skipping`);
      }
    }

    console.log('✓ All migrations completed');
  } catch (error) {
    console.error('Error running migrations:', error);
    // Don't throw - allow the app to continue even if migrations fail
    // This is important for local development where migrations might already be applied
  }
}

