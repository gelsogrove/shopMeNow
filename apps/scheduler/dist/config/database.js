"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionStatus = exports.CampaignFrequency = exports.PlanType = exports.Prisma = exports.prisma = void 0;
exports.connectDatabase = connectDatabase;
exports.disconnectDatabase = disconnectDatabase;
// Import from shared database package
const database_1 = require("@echatbot/database");
Object.defineProperty(exports, "prisma", { enumerable: true, get: function () { return database_1.prisma; } });
Object.defineProperty(exports, "Prisma", { enumerable: true, get: function () { return database_1.Prisma; } });
Object.defineProperty(exports, "PlanType", { enumerable: true, get: function () { return database_1.PlanType; } });
Object.defineProperty(exports, "CampaignFrequency", { enumerable: true, get: function () { return database_1.CampaignFrequency; } });
Object.defineProperty(exports, "SubscriptionStatus", { enumerable: true, get: function () { return database_1.SubscriptionStatus; } });
async function connectDatabase() {
    try {
        await database_1.prisma.$connect();
        console.log('✅ Database connected');
    }
    catch (error) {
        console.error('❌ Database connection failed:', error);
        process.exit(1);
    }
}
async function disconnectDatabase() {
    await database_1.prisma.$disconnect();
    console.log('Database disconnected');
}
//# sourceMappingURL=database.js.map