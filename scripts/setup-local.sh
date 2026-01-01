#!/bin/bash

# eChatbot Local Development Setup Script
# This script installs all required dependencies for local development

set -e  # Exit on error

echo "🚀 eChatbot Local Setup"
echo "======================="
echo ""

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
  echo "⚠️  This script is designed for macOS. For other systems, install dependencies manually."
  exit 1
fi

# Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
  echo "❌ Homebrew not found. Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
else
  echo "✅ Homebrew already installed"
fi

# Install Node.js (if not installed)
if ! command -v node &> /dev/null; then
  echo "📦 Installing Node.js..."
  brew install node
else
  echo "✅ Node.js already installed ($(node -v))"
fi

# Install PostgreSQL client (psql) for database access
if ! command -v psql &> /dev/null; then
  echo "🗄️  Installing PostgreSQL client (psql)..."
  brew install postgresql@16
  
  # Add to PATH
  echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
  export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
  
  echo "✅ PostgreSQL client installed"
else
  echo "✅ PostgreSQL client already installed ($(psql --version))"
fi

# Install Heroku CLI (if not installed)
if ! command -v heroku &> /dev/null; then
  echo "☁️  Installing Heroku CLI..."
  brew tap heroku/brew && brew install heroku
else
  echo "✅ Heroku CLI already installed ($(heroku --version | head -1))"
fi

# Install Docker (optional, for local database)
if ! command -v docker &> /dev/null; then
  echo "🐳 Docker not found. Install Docker Desktop manually from:"
  echo "   https://www.docker.com/products/docker-desktop"
else
  echo "✅ Docker already installed ($(docker --version))"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Copy .env.example to .env and configure variables"
echo "2. Run 'docker-compose up -d' to start local database"
echo "3. Run 'npm install' in root directory"
echo "4. Run 'cd apps/backend && npm run seed' to populate database"
echo "5. Run 'npm run dev' in root to start all services"
echo ""
echo "To connect to Heroku production database:"
echo "  heroku pg:psql -a echatbot-app"
echo ""
