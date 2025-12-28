"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceStatus = exports.SubscriptionStatus = exports.SearchConversationState = exports.AgentType = exports.PricingType = exports.ConfigType = exports.CampaignTargetType = exports.CampaignFrequency = exports.BillingType = exports.TransactionType = exports.PlanType = exports.ItemType = exports.InvitationStatus = exports.UserRole = exports.ChannelType = exports.MessageType = exports.MessageDirection = exports.PaymentStatus = exports.PaymentMethod = exports.OrderStatus = exports.DocumentStatus = exports.ProductStatus = exports.WorkspaceStatus = exports.UserStatus = exports.Prisma = exports.PrismaClient = exports.prisma = void 0;
// Load environment variables from root .env if not already loaded
// This ensures DATABASE_URL is available before PrismaPg adapter is created
require("dotenv/config");
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
// Try to load .env from various locations (monorepo support)
// Use process.cwd() which works in both CommonJS and ES modules
const envPaths = [
    path_1.default.resolve(process.cwd(), '.env'),
    path_1.default.resolve(process.cwd(), '../../.env'),
    path_1.default.resolve(process.cwd(), '../../../.env'),
    path_1.default.resolve(process.cwd(), '../../../../.env'),
];
for (const envPath of envPaths) {
    const result = dotenv_1.default.config({ path: envPath });
    if (result.parsed?.DATABASE_URL || process.env.DATABASE_URL)
        break;
}
// Validate DATABASE_URL is set
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set! Tried paths:', envPaths);
    throw new Error('DATABASE_URL environment variable is required');
}
const index_js_1 = require("./generated/prisma/index.js");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
// Initialize the PostgreSQL adapter with SSL support for Heroku
const pool = new pg_1.Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL?.includes('amazonaws.com') || DATABASE_URL?.includes('heroku')
        ? { rejectUnauthorized: false }
        : false
});
const adapter = new adapter_pg_1.PrismaPg(pool);
// Singleton Prisma client instance
const globalForPrisma = globalThis;
exports.prisma = globalForPrisma.prisma ??
    new index_js_1.PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development'
            ? ['error', 'warn']
            : ['error'],
    });
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = exports.prisma;
}
// Re-export Prisma types and client
var index_js_2 = require("./generated/prisma/index.js");
Object.defineProperty(exports, "PrismaClient", { enumerable: true, get: function () { return index_js_2.PrismaClient; } });
Object.defineProperty(exports, "Prisma", { enumerable: true, get: function () { return index_js_2.Prisma; } });
// Re-export all enums and types from generated client
var index_js_3 = require("./generated/prisma/index.js");
// Enums
Object.defineProperty(exports, "UserStatus", { enumerable: true, get: function () { return index_js_3.UserStatus; } });
Object.defineProperty(exports, "WorkspaceStatus", { enumerable: true, get: function () { return index_js_3.WorkspaceStatus; } });
Object.defineProperty(exports, "ProductStatus", { enumerable: true, get: function () { return index_js_3.ProductStatus; } });
Object.defineProperty(exports, "DocumentStatus", { enumerable: true, get: function () { return index_js_3.DocumentStatus; } });
Object.defineProperty(exports, "OrderStatus", { enumerable: true, get: function () { return index_js_3.OrderStatus; } });
Object.defineProperty(exports, "PaymentMethod", { enumerable: true, get: function () { return index_js_3.PaymentMethod; } });
Object.defineProperty(exports, "PaymentStatus", { enumerable: true, get: function () { return index_js_3.PaymentStatus; } });
Object.defineProperty(exports, "MessageDirection", { enumerable: true, get: function () { return index_js_3.MessageDirection; } });
Object.defineProperty(exports, "MessageType", { enumerable: true, get: function () { return index_js_3.MessageType; } });
Object.defineProperty(exports, "ChannelType", { enumerable: true, get: function () { return index_js_3.ChannelType; } });
Object.defineProperty(exports, "UserRole", { enumerable: true, get: function () { return index_js_3.UserRole; } });
Object.defineProperty(exports, "InvitationStatus", { enumerable: true, get: function () { return index_js_3.InvitationStatus; } });
Object.defineProperty(exports, "ItemType", { enumerable: true, get: function () { return index_js_3.ItemType; } });
Object.defineProperty(exports, "PlanType", { enumerable: true, get: function () { return index_js_3.PlanType; } });
Object.defineProperty(exports, "TransactionType", { enumerable: true, get: function () { return index_js_3.TransactionType; } });
Object.defineProperty(exports, "BillingType", { enumerable: true, get: function () { return index_js_3.BillingType; } });
Object.defineProperty(exports, "CampaignFrequency", { enumerable: true, get: function () { return index_js_3.CampaignFrequency; } });
Object.defineProperty(exports, "CampaignTargetType", { enumerable: true, get: function () { return index_js_3.CampaignTargetType; } });
Object.defineProperty(exports, "ConfigType", { enumerable: true, get: function () { return index_js_3.ConfigType; } });
Object.defineProperty(exports, "PricingType", { enumerable: true, get: function () { return index_js_3.PricingType; } });
Object.defineProperty(exports, "AgentType", { enumerable: true, get: function () { return index_js_3.AgentType; } });
Object.defineProperty(exports, "SearchConversationState", { enumerable: true, get: function () { return index_js_3.SearchConversationState; } });
Object.defineProperty(exports, "SubscriptionStatus", { enumerable: true, get: function () { return index_js_3.SubscriptionStatus; } });
Object.defineProperty(exports, "InvoiceStatus", { enumerable: true, get: function () { return index_js_3.InvoiceStatus; } });
// Export prisma as default
exports.default = exports.prisma;
