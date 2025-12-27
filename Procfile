# 🌐 WEB DYNO - Backend API + Frontend (NO Scheduler)
web: npx ts-node --project apps/backend/tsconfig.json apps/backend/src/index.ts

# ⏱️ SCHEDULER DYNO - Background jobs only (separate app)
scheduler: npx ts-node --project apps/scheduler/tsconfig.json apps/scheduler/src/index.ts

# 🔄 RELEASE - Run migrations before deploy
release: npm run prisma:migrate:prod
