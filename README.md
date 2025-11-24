# ShopMe - AI-Powered WhatsApp E-commerce Platform

A comprehensive WhatsApp e-commerce platform with AI-powered chatbot, simplified LLM architecture, and multi-language support.

## 🚀 Features

- **🤖 AI Chatbot**: Direct LLM integration with intelligent responses
- **🛍️ E-commerce**: Complete product catalog, cart, and order management
- **📊 Analytics**: Usage tracking and business insights
- **🌍 Multi-language**: Native LLM support for Italian, English, Spanish, and Portuguese
- **🔐 Security**: 2FA authentication, token-based auth, and workspace isolation ([Auth Fix Details](docs/AUTH_TOKEN_PERSISTENCE_FIX.md))
- **📱 Secure Links**: Temporary authenticated access to orders and profiles
- **⚡ Simplified Architecture**: Direct LLM processing without intermediate layers

## 🏗️ Architecture

### Simplified LLM System

- **LLMService**: Direct processing and response generation
- **Cloud Functions**: Specific actions (tracking, orders, operator contact)
- **Variable Replacement**: Dynamic content personalization
- **Link Generation**: Secure temporary access tokens

### Technology Stack

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + Prisma ORM
- **Database**: PostgreSQL
- **AI**: OpenRouter integration with GPT-4-mini
- **Authentication**: JWT-based token system

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- PostgreSQL

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd shopME
   ```

2. **Start database (Docker)**

   ```bash
   docker compose up -d
   ```

3. **Install backend dependencies**

   ```bash
   cd backend
   npm install
   ```

4. **Install frontend dependencies**

   ```bash
   cd ../frontend
   npm install
   ```

5. **Environment setup**

   ```bash
   cd ../backend
   cp .env.example .env
   
   # Configure your environment variables in .env
   # Most important: DATABASE_URL is already set for local development
   ```

6. **Build frontend**

   ```bash
   cd ../frontend
   npm run build
   ```

7. **Setup database**

   ```bash
   cd ../backend
   npx prisma migrate deploy
   npm run seed
   ```

8. **Start development servers**

   ```bash
   # Terminal 1: Start frontend
   cd frontend && npm run dev
   
   # Terminal 2: Start backend
   cd backend && npm run dev
   ```

### Access Points

- **Frontend**: http://localhost:3000
  - Login: `admin@shopme.com` / `venezia44`
- **Backend API**: http://localhost:3001
- **Database**: localhost:5434
  - User: `shopmefy` / `shopmefy`

## 📁 Project Structure

```
shop/
├── backend/                 # Node.js backend application
│   ├── src/
│   │   ├── controllers/     # API controllers
│   │   ├── services/        # Business logic
│   │   ├── repositories/    # Data access layer
│   │   ├── domain/          # Domain entities
│   │   └── prisma/          # Database schema and migrations
│   └── package.json
├── frontend/                # React frontend application
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Page components
│   │   ├── services/        # API services
│   │   └── hooks/           # Custom React hooks
│   └── package.json
├── scripts/                 # Automation scripts
├── docs/                    # Documentation
└── docker-compose.yml       # Docker services configuration
```

## 🔧 Development

### Available Scripts

```bash
# Development (with hot-reload)
npm run dev                    # Start all services
cd backend && npm run dev      # Backend only (port 3001)
cd frontend && npm run dev     # Frontend only (port 3000)

# Production (with PM2 auto-restart)
cd backend && npm start        # Start backend with PM2
cd backend && npm stop         # Stop backend
cd backend && npm restart      # Restart backend
cd backend && npm run logs     # View backend logs
cd backend && npm run status   # Check backend status

# Database operations
cd backend && npm run db:reset
cd backend && npm run seed

# Testing
cd backend && npm run test
cd frontend && npm run test
```

### Database Management

```bash
# Reset database
cd backend && npm run db:reset

# Run migrations
cd backend && npm run db:migrate

# Seed data
cd backend && npm run seed
```

### Agent Prompts Management

**Multi-Agent System**: ShopME uses 6 specialized agents (ROUTER, PRODUCT_SEARCH, CART_MANAGEMENT, ORDER_TRACKING, CUSTOMER_SUPPORT, SAFETY_TRANSLATION).

```bash
# Export prompts from database to markdown files
cd backend && npm run export:prompts

# Update database from markdown files
cd backend && npm run update:prompts
```

**Workflow**:

1. Edit prompts in UI (`/agent` page) or modify `.md` files in `docs/prompts/`
2. Export changes: `npm run export:prompts` (Database → .md files)
3. Review exported files in `docs/prompts/`
4. Commit changes to Git
5. To restore: `npm run update:prompts` (.md files → Database)

**Files**: `docs/prompts/router-agent.md`, `product-search.md`, `cart-management.md`, `order-tracking.md`, `customer-support.md`, `safety-translation.md`

### Pricing Management

**⚠️ IMPORTANT**: All pricing changes preserve historical billing records.

```bash
# View current pricing
cd backend && npm run view-pricing

# Update pricing (modify backend/scripts/update-pricing.ts first)
cd backend && npm run update-pricing
```

**Single Source of Truth**: `backend/prisma/data/pricingConfig.ts`

For detailed pricing management guide, see: [`docs/memory-bank/05-guides/pricing-management.md`](docs/memory-bank/05-guides/pricing-management.md)

**Pricing Types**:

- **PLAN**: Monthly subscription costs (€0-€149)
- **USAGE**: Pay-per-use costs (€0.15-€1.50 per action)
- **THRESHOLD**: Free tier limits (50-200 units)

**Key Guarantee**: Historical billing records preserve the price at transaction time. Changing prices only affects new transactions.

## 🤖 AI Integration

The platform uses OpenRouter for AI processing:

- **Language Detection**: Automatic detection of user language
- **Intent Classification**: Understanding user requests
- **Response Generation**: Natural language responses
- **Function Calling**: Dynamic API calls based on user intent

### 🎯 Design Philosophy: Chatbot as Link Generator

**IMPORTANT ARCHITECTURAL DECISION**: The chatbot's primary role is to **generate secure links** that redirect users to the web interface for complex operations.

**Chatbot Capabilities** (Direct in chat):

- ✅ Product discovery & search
- ✅ Cart addition (products/services)
- ✅ Order information & tracking
- ✅ Customer support & operator contact
- ✅ Generate cart/order/profile links

**Web Interface Capabilities** (Via generated links):

- ✅ Cart modifications (quantities, item removal)
- ✅ New order creation
- ✅ Checkout & payment
- ✅ Profile management
- ✅ Order history

**Why This Approach**:

1. **User Experience**: Complex UI operations (quantity changes, multi-step forms) are better handled in web interface
2. **Security**: Temporary authenticated tokens allow seamless transition without re-login
3. **Simplicity**: Chatbot focuses on conversational discovery, web handles transactional complexity
4. **Maintenance**: No need for duplicate cart modification logic (RemoveProduct/UpdateCartItem CF not needed)

**Example Flow**:

```
User: "dammi il carrello"
Bot: "Ecco il tuo carrello 🛒 [LINK]"
User: [clicks link] → Web interface with full cart editing capabilities
```

## 🔐 Security Features

- **Workspace Isolation**: Complete data separation between workspaces
- **Token Authentication**: Secure token-based access for public pages
- **Rate Limiting**: Protection against abuse
- **Input Validation**: Comprehensive input sanitization

## 📊 Usage Tracking & Billing

**Dynamic Pricing System** - All prices are stored in the database and fetched in real-time:

- **Message**: €0.15 per AI-powered response
- **New Customer**: €1.00 per registration
- **New Order**: €1.50 per completed order
- **Push Campaign**: €1.00 per notification

**Features**:

- ✅ **Single Source of Truth**: Database-driven pricing
- ✅ **Historical Preservation**: Billing records maintain original prices
- ✅ **Automatic Updates**: Frontend and Backend sync automatically
- ✅ **Analytics Dashboard**: Complete usage statistics
- ✅ **Workspace Filtering**: Isolated tracking per workspace

View current pricing: `npm run view-pricing` (in backend directory)

## 🌍 Multi-language Support

Supported languages:

- **Italian (IT)**: Primary language
- **English (EN)**: International support
- **Spanish (ES)**: Latin American market
- **Portuguese (PT)**: Brazilian market

## 📱 Public Access

Customers can access their data via secure links:

- **Orders**: `/orders-public?token=...`
- **Profile**: `/customer-profile?token=...`
- **Checkout**: `/checkout-public?token=...`

## 🧪 Testing

```bash
# Run unit tests
cd backend && npm run test:unit

# Frontend tests
cd frontend && npm run test
```

## 🛠️ Troubleshooting

### Database Connection Issues

**Error**: `Can't reach database server at localhost:5434`

**Solution**:
```bash
# Check if PostgreSQL container is running
docker ps

# If container is restarting, check logs
docker logs shop_db

# For PostgreSQL 18+ compatibility issues, recreate the volume:
docker-compose down
docker volume rm shopme_postgres_data
docker-compose up -d

# Wait for database to be ready, then migrate
cd backend
npx prisma migrate deploy
npm run seed
```

### Missing Environment Variables

**Error**: `Environment variable not found: DATABASE_URL`

**Solution**:
```bash
cd backend
cp .env.example .env
# Edit .env file with your settings
```

### SMTP Configuration (Optional)

For email functionality, configure these variables in `backend/.env`:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

**Note**: If SMTP is not configured, the system will use test accounts in development.

## 📚 Documentation

- **PRD**: `docs/PRD.md` - Product Requirements Document
- **API**: Swagger documentation at `/api/docs`
- **Architecture**: `docs/architecture.md`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is proprietary software. All rights reserved.

## 🆘 Support

For support and questions:

- Check the documentation in `docs/`
- Review the PRD for feature specifications
- Contact the development team
```
