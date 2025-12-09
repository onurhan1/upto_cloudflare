# Upto - Cloudflare Uptime Monitoring Platform

A comprehensive uptime monitoring and incident management platform built entirely on Cloudflare's infrastructure.

## Features

- ✅ **Uptime Monitoring**: Monitor HTTP, API, Ping, DNS, SSL, and Domain services
- ✅ **Incident Management**: Automatic incident creation and resolution
- ✅ **Status Pages**: Public status pages with customizable themes
- ✅ **Alerting**: Telegram and Email notifications
- ✅ **Real-time Updates**: Durable Objects for state management
- ✅ **Flapping Detection**: Prevents alert spam from unstable services
- ✅ **Dashboard**: Beautiful Next.js dashboard with real-time data

## Tech Stack

- **Backend**: Cloudflare Workers (Hono.js)
- **Frontend**: Next.js 14 (App Router) + TailwindCSS
- **Database**: Cloudflare D1 (SQLite)
- **Cache**: Cloudflare KV
- **State**: Durable Objects
- **Queue**: Cloudflare Queues
- **Scheduler**: Cloudflare Cron Triggers
- **Storage**: Cloudflare R2
- **Notifications**: Telegram Bot API + MailChannels

## Quick Start

See [infrastructure/docs/README.md](./infrastructure/docs/README.md) for detailed setup instructions.

### Prerequisites
- Node.js 18+
- Cloudflare account
- Wrangler CLI: `npm install -g wrangler`

### Setup
```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Run setup script
chmod +x scripts/setup.sh
./scripts/setup.sh

# Update wrangler.toml with resource IDs from setup

# Set secrets
cd backend
wrangler secret put JWT_SECRET

# Run migrations
npm run migrate:dev
npm run seed:dev
```

### Development
```bash
# Backend (port 8787)
cd backend && npm run dev

# Frontend (port 3000)
cd frontend && npm run dev
```

## Project Structure

```
/
├── backend/              # Cloudflare Workers API
│   ├── src/
│   │   ├── api/         # API routes
│   │   ├── monitoring/   # Monitoring logic
│   │   ├── utils/       # Utilities
│   │   └── types/       # TypeScript types
│   └── package.json
├── frontend/            # Next.js frontend
│   ├── src/
│   │   ├── app/         # Next.js app router pages
│   │   └── lib/         # API client, utilities
│   └── package.json
├── infrastructure/      # Config and migrations
│   ├── migrations/      # D1 SQL migrations
│   ├── docs/           # Documentation
│   └── wrangler.toml   # Cloudflare config
└── scripts/            # Setup and deploy scripts
```

## Documentation

- [Setup Guide](./infrastructure/docs/README.md)
- [API Documentation](./infrastructure/docs/README.md#api-endpoints)
- [Database Schema](./infrastructure/migrations/0001_initial_schema.sql)

## License

MIT License

