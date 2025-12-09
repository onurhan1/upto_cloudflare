# Upto - Cloudflare Uptime Monitoring Platform

Upto is a comprehensive uptime monitoring and incident management platform built entirely on Cloudflare's infrastructure. It provides real-time monitoring, incident management, status pages, and alerting capabilities.

## Architecture

### Backend (Cloudflare Workers)
- **API Worker**: Hono.js-based REST API handling authentication, service management, incidents, and status pages
- **Monitoring Engine**: Cron-triggered worker that schedules health checks via Cloudflare Queues
- **Queue Consumer**: Processes health check jobs and updates service status

### Frontend (Next.js + Cloudflare Pages)
- **Dashboard**: Service overview, uptime statistics, and incident management
- **Service Management**: Create, update, and monitor services
- **Incident Management**: Track and resolve incidents
- **Public Status Pages**: Customizable public status pages

### Cloudflare Services Used
- **D1**: SQL database for persistent data
- **KV**: Caching service status snapshots and status page data
- **Durable Objects**: State management and flapping detection
- **Queues**: Job queue for health checks
- **R2**: Static asset storage
- **Cron Triggers**: Scheduled health check scheduling
- **MailChannels**: Email notifications
- **Telegram Bot API**: Telegram notifications

## Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- Cloudflare account with Workers paid plan (for D1, Queues, etc.)
- Wrangler CLI installed globally: `npm install -g wrangler`

### Initial Setup

1. **Clone and install dependencies:**
   ```bash
   # Backend
   cd backend
   npm install
   
   # Frontend
   cd ../frontend
   npm install
   ```

2. **Create Cloudflare resources:**
   ```bash
   # Run setup script
   chmod +x ../scripts/setup.sh
   ../scripts/setup.sh
   ```

3. **Update wrangler.toml:**
   - Copy the database IDs from the setup output
   - Copy the KV namespace IDs
   - Update `infrastructure/wrangler.toml` with these IDs

4. **Set secrets:**
   ```bash
   cd backend
   wrangler secret put JWT_SECRET
   # Optional:
   wrangler secret put TELEGRAM_BOT_TOKEN
   wrangler secret put MAILCHANNELS_API_KEY
   ```

5. **Run migrations:**
   ```bash
   cd backend
   npm run migrate:dev
   npm run seed:dev
   ```

### Development

**Backend:**
```bash
cd backend
npm run dev
```

**Frontend:**
```bash
cd frontend
npm run dev
```

The backend will run on `http://localhost:8787` and frontend on `http://localhost:3000`.

### Deployment

**Backend:**
```bash
cd backend
npm run deploy
```

**Frontend:**
Deploy to Cloudflare Pages:
1. Connect your GitHub repository to Cloudflare Pages
2. Set build command: `npm run build`
3. Set output directory: `out`
4. Set environment variable: `NEXT_PUBLIC_API_URL` to your Worker URL

Or use the deploy script:
```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login and get JWT token

### Services
- `GET /services` - List user's services
- `POST /services` - Create new service
- `GET /services/:id` - Get service details
- `PATCH /services/:id` - Update service
- `DELETE /services/:id` - Delete service
- `POST /services/:id/test` - Manually trigger health check

### Incidents
- `GET /incidents` - List incidents (filterable)
- `GET /incidents/:id` - Get incident details
- `POST /incidents` - Create incident
- `PATCH /incidents/:id` - Update incident

### Status Pages
- `GET /status-page/mine` - Get user's status pages
- `POST /status-page` - Create status page
- `GET /status-page/:id` - Get status page details
- `PATCH /status-page/:id` - Update status page
- `DELETE /status-page/:id` - Delete status page
- `POST /status-page/:id/services` - Add service to status page

### Public
- `GET /public/status/:slug` - Get public status page data (JSON)
- `GET /health` - Health check endpoint

### Integrations
- `GET /integrations` - Get integration settings
- `PATCH /integrations/telegram` - Update Telegram integration
- `PATCH /integrations/email` - Update email integration

### Telegram
- `POST /telegram/webhook` - Telegram bot webhook

## Database Schema

See `infrastructure/migrations/0001_initial_schema.sql` for the complete database schema.

Main tables:
- `users` - User accounts
- `monitored_services` - Services being monitored
- `service_checks` - Health check results
- `incidents` - Incident records
- `incident_updates` - Incident timeline updates
- `integrations` - Notification settings
- `status_pages` - Public status pages
- `status_page_services` - Services displayed on status pages

## Monitoring Flow

1. **Cron Trigger** (every minute):
   - Fetches all active services from D1
   - Queues health check jobs for services that need checking

2. **Queue Consumer**:
   - Processes health check jobs
   - Performs HTTP/API/Ping/DNS checks
   - Saves results to D1 `service_checks` table
   - Updates KV snapshots
   - Updates Durable Object state

3. **Incident Management**:
   - Automatically creates incidents when service goes down
   - Resolves incidents when service recovers
   - Sends notifications via Telegram/Email

4. **Flapping Detection**:
   - Durable Objects track recent state changes
   - Suppresses alerts if service is flapping (rapid state changes)

## Configuration

### Environment Variables

**Backend (set via `wrangler secret put`):**
- `JWT_SECRET` - Secret for JWT token signing (required)
- `TELEGRAM_BOT_TOKEN` - Telegram bot token (optional)
- `MAILCHANNELS_API_KEY` - MailChannels API key (optional)
- `ENVIRONMENT` - Environment name (development/production)

**Frontend:**
- `NEXT_PUBLIC_API_URL` - Backend API URL

## Security

- JWT-based authentication
- Role-based access control (admin/user/readonly)
- CORS protection
- Input validation
- SQL injection protection via D1 prepared statements

## Limitations & Notes

- Password hashing uses SHA-256 (simple implementation). For production, consider using a more secure method.
- Ping checks are implemented as HTTP checks (Cloudflare Workers don't support ICMP)
- DNS/SSL checks are simplified (full implementation would require additional libraries)
- Rate limiting is not implemented (can be added using KV or Durable Objects)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License

## Support

For issues and questions, please open an issue on GitHub.

