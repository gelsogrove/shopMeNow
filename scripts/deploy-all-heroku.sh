#!/bin/bash

# 🚀 Deploy All to Heroku - eChatbot (3 Apps)
# Script che buildi in locale (test) e deploya su tutte le 3 app Heroku

set -e  # Exit on error

echo "🏗️  Step 1/4: Build locale (test di sicurezza)..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Build fallito! Correggi gli errori prima di deployare."
  exit 1
fi

echo "✅ Build locale completato con successo!"
echo ""

echo "🚀 Step 2/4: Deploy echatbot-app (Backend + Frontend monolith)..."
git push heroku-app main

echo ""
echo "🚀 Step 3/4: Deploy echatbot-backoffice (Admin Panel)..."
git push heroku-backoffice main

echo ""
echo "🚀 Step 4/4: Deploy echatbot-scheduler (Worker)..."
git push heroku-scheduler main

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
