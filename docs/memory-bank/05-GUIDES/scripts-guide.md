# Scripts Guide

> **Available npm scripts and common development tasks**
>
> Backend | Frontend | Database | Testing | Deployment

---

## 🎯 Quick Reference

```bash
# Start development servers
npm run dev              # Start backend (port 3001)
cd frontend && npm run dev   # Start frontend (port 3000)

# Database operations
npm run seed             # Seed database with test data
npm run update-prompt    # Update agent prompt from docs/prompt_agent.md

# Testing
npm run test:unit        # Run unit tests
npm run test:coverage    # Run tests with coverage report
npm run test:security    # Run security-specific tests

# Build
npm run build            # Build backend (TypeScript + Prisma)
cd frontend && npm run build  # Build frontend (Vite)
```

---

## 🔧 Backend Scripts

### Development

#### `npm run dev`

Start backend development server with hot-reload

```bash
cd backend
npm run dev
```

- **Port**: 3001
- **Hot-reload**: ✅ (ts-node-dev)
- **Environment**: `.env` file
- **Output**: Logs to console + `backend/logs/`

#### `npm run start`

Start production server

```bash
npm run start
```

- **Requires**: `npm run build` first
- **No hot-reload**: Production mode
- **PM2 ready**: Can be used with process managers

### Building

#### `npm run build`

Compile TypeScript and generate Prisma client

```bash
npm run build
```

**Steps**:

1. Generate Prisma Client (`npx prisma generate`)
2. Compile TypeScript (`tsc`)
3. Output to `dist/` folder

**Verify**:

```bash
ls -la dist/
# Should see compiled .js files
```

### Database

#### `npm run seed`

Populate database with test data

```bash
cd backend
npm run seed
```

**Creates**:

- 1 workspace (Venezia)
- 1 admin user (`admin@shopme.com` / `venezia44`)
- 50+ products
- 30+ FAQs
- 20+ services
- 4 test customers with chat history
- 7 sample orders

**Truncates**: All existing data (⚠️ destructive)

**Usage**:

```bash
# Fresh start
docker-compose restart postgres
npm run seed

# After schema changes
npx prisma migrate dev
npm run seed
```

#### `npx prisma migrate dev`

Create and apply database migration

```bash
npx prisma migrate dev --name add_new_field
```

**When to use**:

- After editing `prisma/schema.prisma`
- Adding new tables/columns
- Modifying relationships

**Steps**:

1. Edit `prisma/schema.prisma`
2. Run migration command
3. Migration applied + Prisma client regenerated
4. Update seed if needed

#### `npx prisma generate`

Regenerate Prisma Client after schema changes

```bash
npx prisma generate
```

**When to use**:

- After `git pull` with schema changes
- After manual schema edits (without migration)
- If `@prisma/client` types are outdated

#### `npx prisma studio`

Open Prisma Studio (database GUI)

```bash
npx prisma studio
```

- **Port**: 5555
- **Features**: Browse, edit, delete records
- **Usage**: Quick data inspection/modification

#### `npm run update-prompt`

Update agent system prompt from markdown file

```bash
cd backend
npm run update-prompt
```

**Process**:

1. Reads `docs/prompt_agent.md`
2. Updates `agentConfig.systemPrompt` in database
3. Applies to all workspaces (or specific one)

**Usage**:

```bash
# After editing docs/prompt_agent.md
npm run update-prompt

# Verify in database
npx prisma studio
# → agentConfig table → systemPrompt field
```

### Testing

#### `npm run test:unit`

Run Jest unit tests

```bash
cd backend
npm run test:unit
```

**Coverage**: Services, repositories, utilities  
**Mocks**: Database, external APIs  
**Output**: Console + `coverage/` folder

#### `npm run test:coverage`

Run tests with coverage report

```bash
npm run test:coverage
```

**Output**:

- Terminal: Coverage summary
- `coverage/lcov-report/index.html`: Detailed HTML report

**Coverage Targets**:

- Statements: 80%+
- Branches: 75%+
- Functions: 80%+
- Lines: 80%+

#### `npm run test:security`

Run security-specific tests

```bash
npm run test:unit -- --testPathPattern=security
```

**Tests**:

- Hard rate limiting
- WhatsApp rate limiting
- Session validation
- Translation security (profanity, spam, phishing)

#### `npm run test:integration`

Run integration tests (requires running backend)

```bash
# Terminal 1: Start backend
npm run dev

# Terminal 2: Run tests
npm run test:integration
```

**Coverage**: API endpoints, authentication, database operations

### Linting & Formatting

#### `npm run lint`

Run ESLint

```bash
npm run lint
```

**Fix automatically**:

```bash
npm run lint -- --fix
```

#### `npm run format`

Run Prettier

```bash
npm run format
```

**Check without formatting**:

```bash
npm run format -- --check
```

---

## 🎨 Frontend Scripts

### Development

#### `npm run dev`

Start frontend development server

```bash
cd frontend
npm run dev
```

- **Port**: 3000
- **Hot-reload**: ✅ (Vite HMR)
- **Proxy**: API requests → `http://localhost:3001`

#### `npm run build`

Build production bundle

```bash
npm run build
```

**Steps**:

1. Clean `dist/` folder
2. TypeScript type-check
3. Vite build (minify, bundle, optimize)

**Output**: `dist/` folder

**Verify**:

```bash
npm run preview  # Serve production build locally
```

#### `npm run preview`

Preview production build

```bash
npm run build
npm run preview
```

- **Port**: 4173
- **Purpose**: Test production build before deployment

### Testing

#### `npm run test`

Run Vitest tests

```bash
cd frontend
npm run test
```

**Coverage**: Components, hooks, utilities

#### `npm run test:ui`

Run tests with Vitest UI

```bash
npm run test:ui
```

- Opens browser UI
- Interactive test runner
- Coverage visualization

### Linting & Formatting

#### `npm run lint`

Run ESLint

```bash
npm run lint
```

#### `npm run format`

Run Prettier

```bash
npm run format
```

---

## 🐳 Docker Scripts

### Start Services

```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d postgres
docker-compose up -d redis
```

### Stop Services

```bash
# Stop all
docker-compose down

# Stop and remove volumes (⚠️ deletes data)
docker-compose down -v
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f postgres
```

### Database Management

```bash
# Access PostgreSQL shell
docker-compose exec postgres psql -U shopme -d shopme_db

# Backup database
docker-compose exec postgres pg_dump -U shopme shopme_db > backup.sql

# Restore database
docker-compose exec -T postgres psql -U shopme shopme_db < backup.sql
```

---

## 🚀 Deployment Scripts

### Production Build

```bash
# Backend
cd backend
npm run build
npm run start

# Frontend
cd frontend
npm run build
# Serve dist/ folder with nginx/apache
```

### Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit with production values
vim .env
```

**Required variables**:

```bash
DATABASE_URL="postgresql://..."
JWT_SECRET="random-256-bit-string"
OPENROUTER_API_KEY="sk-..."
WHATSAPP_ACCESS_TOKEN="..."
WHATSAPP_PHONE_NUMBER_ID="..."
WHATSAPP_VERIFY_TOKEN="..."
```

### Database Migration (Production)

```bash
# 1. Backup current database
docker-compose exec postgres pg_dump -U shopme shopme_db > pre-migration-backup.sql

# 2. Apply migrations
npx prisma migrate deploy

# 3. Verify
npx prisma studio

# 4. If issues, rollback
docker-compose exec -T postgres psql -U shopme shopme_db < pre-migration-backup.sql
```

---

## 🔍 Debugging Scripts

### Check Backend Health

```bash
curl http://localhost:3001/health
# Expected: {"status":"ok"}
```

### Check Frontend Build

```bash
cd frontend
npm run build
ls -lh dist/  # Check bundle sizes
```

### Check Database Connection

```bash
npx prisma db pull
# Should succeed if connection works
```

### Check Environment Variables

```bash
# Backend
node -e "require('dotenv').config(); console.log(process.env.DATABASE_URL)"

# Frontend
cat .env | grep VITE_
```

---

## 📊 Useful One-Liners

### Count lines of code

```bash
# Backend
find backend/src -name "*.ts" | xargs wc -l

# Frontend
find frontend/src -name "*.tsx" -o -name "*.ts" | xargs wc -l
```

### Find TODO comments

```bash
grep -r "TODO" backend/src frontend/src
```

### Check for console.log (remove before prod)

```bash
grep -r "console.log" backend/src frontend/src
```

### List all API endpoints

```bash
grep -r "router\." backend/src/interfaces/http/routes/
```

### Check package sizes

```bash
# Backend
npm list --depth=0

# Frontend
cd frontend && npm list --depth=0
```

---

## 🧹 Cleanup Scripts

### Remove node_modules

```bash
# Backend
cd backend && rm -rf node_modules package-lock.json

# Frontend
cd frontend && rm -rf node_modules package-lock.json

# Reinstall
npm install
```

### Clean build artifacts

```bash
# Backend
cd backend && rm -rf dist coverage

# Frontend
cd frontend && rm -rf dist coverage
```

### Reset database (⚠️ destructive)

```bash
docker-compose down -v
docker-compose up -d postgres
cd backend && npm run seed
```

---

## 📝 Common Workflows

### Adding New Feature

```bash
# 1. Create feature branch
git checkout -b feature/new-feature

# 2. Make changes

# 3. Run tests
npm run test:unit
npm run test:coverage

# 4. Build
npm run build

# 5. Commit
git add .
git commit -m "feat: add new feature"
```

### Updating Dependencies

```bash
# Check outdated
npm outdated

# Update specific package
npm update package-name

# Update all (⚠️ test thoroughly)
npm update

# Verify
npm run test:unit
npm run build
```

### Database Schema Change

```bash
# 1. Edit schema
vim prisma/schema.prisma

# 2. Create migration
npx prisma migrate dev --name add_new_table

# 3. Update seed
vim prisma/seed.ts

# 4. Test
npm run seed
npm run test:unit
```

---

**Last Updated**: October 14, 2025  
**Maintained by**: Andrea (gelsogrove)
