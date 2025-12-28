# 🌐 WEB DYNO - Backend API (Compiled JavaScript)
web: node apps/backend/dist/src/index.js

# ⏱️ SCHEDULER DYNO - Background jobs only (separate app)
scheduler: node apps/scheduler/dist/index.js

# 🔄 RELEASE - Run migrations before deploy
release: npm run prisma:migrate:prod
