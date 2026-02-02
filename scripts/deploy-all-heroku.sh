#!/bin/bash

# 🚀 Deploy All to Heroku - eChatbot (3 Apps)
# Script che buildi in locale (test) e deploya su tutte le 3 app Heroku

set -e  # Exit on error

echo "🗄️  Step 1/8: Prisma migrate locale..."
cd packages/database
npx prisma migrate deploy
echo "✅ Migrations applicate in locale!"
cd ../..

echo "🔄 Step 2/8: Prisma generate locale..."
cd packages/database
npx prisma generate
echo "✅ Prisma client generato!"
cd ../..

echo "🏗️  Step 3/8: Build locale (test di sicurezza)..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Build fallito! Correggi gli errori prima di deployare."
  exit 1
fi

echo "✅ Build locale completato con successo!"
echo ""

echo "🧪 Step 4/8: Running unit tests..."
cd apps/backend
npm run test:unit

if [ $? -ne 0 ]; then
  echo "❌ Test falliti! Correggi gli errori prima di deployare."
  exit 1
fi

echo "✅ Test completati con successo!"
cd ../..
echo ""

echo "🚀 Step 5/8: Deploy echatbot-app (Backend + Frontend monolith)..."
git push heroku-app main

echo ""
echo "🚀 Step 6/8: Deploy echatbot-backoffice (Admin Panel)..."
git push heroku-backoffice main

echo ""
echo "🚀 Step 7/8: Deploy echatbot-scheduler (Worker)..."
git push heroku-scheduler main

echo ""
echo "🗄️  Step 8/8: Post-deploy - Applying migrations on Heroku production database..."
heroku run "cd packages/database && npx prisma migrate deploy" -a echatbot-app

echo ""
echo "🔄 Regenerating Prisma client on Heroku..."
heroku run "cd packages/database && npx prisma generate" -a echatbot-app

echo ""
echo "♻️  Restarting app to reload cache..."
heroku restart -a echatbot-app

echo ""
echo "✅ ✅ ✅ DEPLOY COMPLETATO SU TUTTE LE 3 APP! ✅ ✅ ✅"
echo ""
echo "📊 Verifica deploy:"
echo "  heroku logs --tail --app echatbot-app"
echo "  heroku logs --tail --app echatbot-backoffice"
echo "  heroku logs --tail --app echatbot-scheduler"
echo ""
echo "🌐 Apri le app:"
echo "  heroku open --app echatbot-app"
echo "  heroku open --app echatbot-backoffice"
