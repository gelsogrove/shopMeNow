# 🌐 WEB DYNO - Backend API + Frontend (NO Scheduler)
web: cd apps/backend && npx ts-node src/index.ts

# ⏱️ SCHEDULER DYNO - Background jobs only (separate app)
scheduler: cd apps/scheduler && npx ts-node src/index.ts

# 🔄 RELEASE - Run migrations before deploy
release: npm run prisma:migrate:prod
