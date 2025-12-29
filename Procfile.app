# 🌐 ECHATBOT-APP - Frontend + Backend API
# Deploy: git push heroku-app main
# Serve: Frontend (/) + Backend API (/api)

web: node apps/backend/dist/src/index.js
release: npm run prisma:migrate:prod
