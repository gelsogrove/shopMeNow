# 🌐 ECHATBOT-APP (default) - Frontend + Backend API
# This Procfile is used by default for echatbot-app
# For other apps, use: Procfile.scheduler, Procfile.backoffice

web: node apps/backend/dist/src/index.js
release: npm run prisma:migrate:prod
