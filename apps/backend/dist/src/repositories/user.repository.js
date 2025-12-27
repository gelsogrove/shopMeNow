"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRepository = void 0;
const user_entity_1 = require("../domain/entities/user.entity");
const logger_1 = __importDefault(require("../utils/logger"));
const database_1 = require("@echatbot/database");
class UserRepository {
    constructor(prismaClient) {
        this.prisma = prismaClient || database_1.prisma;
    }
    /**
     * Map database model to domain entity
     */
    mapToDomain(data) {
        return user_entity_1.User.create({
            id: data.id,
            email: data.email,
            password: data.passwordHash,
            name: data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim(),
            firstName: data.firstName,
            lastName: data.lastName,
            status: data.status,
            workspaceId: data.workspaceId,
            role: data.role,
            isPlatformAdmin: data.isPlatformAdmin || false, // 🔐 Platform Admin flag for Backoffice access
            isDeveloperUser: data.isDeveloperUser || false, // 🔧 Developer user flag (skip 2FA)
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            lastLogin: data.lastLogin,
            // 🔒 2FA fields (CRITICAL for security checks)
            twoFactorEnabled: data.twoFactorEnabled,
            twoFactorSecret: data.twoFactorSecret,
            twoFactorEnabledAt: data.twoFactorEnabledAt,
            recoveryCodes: data.recoveryCodes,
            // 📱 Personal phone (optional)
            phoneNumber: data.phoneNumber,
            // 🌐 Language preference
            language: data.language || 'ENG',
            // 🧾 Billing fields (Andrea's requirement - MUST be mapped from DB)
            companyName: data.companyName,
            vatNumber: data.vatNumber,
            website: data.website,
            billingPhone: data.billingPhone,
            billingAddress: data.billingAddress,
            // 🖼️ Company logo
            logo: data.logo,
            // 🔐 Auth provider info (for OAuth set-password feature)
            authProvider: data.authProvider,
            passwordHash: data.passwordHash,
        });
    }
    /**
     * Map domain entity to database model
     */
    mapToDatabase(user) {
        return {
            id: user.id || undefined,
            email: user.email,
            passwordHash: user.password,
            firstName: user.firstName,
            lastName: user.lastName,
            status: user.status || 'ACTIVE',
            workspaceId: user.workspaceId,
            role: user.role,
            lastLogin: user.lastLogin,
        };
    }
    /**
     * Find all users
     */
    findAll() {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.debug('Finding all users');
            try {
                const users = yield this.prisma.user.findMany({
                    orderBy: { createdAt: 'asc' },
                });
                logger_1.default.debug(`Found ${users.length} users`);
                return users.map(user => this.mapToDomain(user));
            }
            catch (error) {
                logger_1.default.error('Error finding users:', error);
                throw error;
            }
        });
    }
    /**
     * Find a user by ID
     */
    findById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.debug(`Finding user by ID: ${id}`);
            try {
                const user = yield this.prisma.user.findUnique({
                    where: { id },
                });
                if (!user) {
                    logger_1.default.debug(`User with ID ${id} not found`);
                    return null;
                }
                logger_1.default.debug(`Found user with ID ${id}`);
                return this.mapToDomain(user);
            }
            catch (error) {
                logger_1.default.error(`Error finding user with ID ${id}:`, error);
                throw error;
            }
        });
    }
    /**
     * Find a user by email
     */
    findByEmail(email) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.debug(`Finding user by email: ${email}`);
            try {
                const user = yield this.prisma.user.findUnique({
                    where: { email },
                });
                if (!user) {
                    logger_1.default.debug(`User with email ${email} not found`);
                    return null;
                }
                logger_1.default.debug(`Found user with email ${email}`);
                return this.mapToDomain(user);
            }
            catch (error) {
                logger_1.default.error(`Error finding user with email ${email}:`, error);
                throw error;
            }
        });
    }
    /**
     * Create a new user
     */
    create(user) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.debug(`Creating new user with email ${user.email}`);
            try {
                const data = this.mapToDatabase(user);
                const createdUser = yield this.prisma.user.create({
                    data,
                });
                logger_1.default.debug(`Created user with ID ${createdUser.id}`);
                return this.mapToDomain(createdUser);
            }
            catch (error) {
                logger_1.default.error('Error creating user:', error);
                throw error;
            }
        });
    }
    /**
     * Update an existing user
     */
    update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.debug(`Updating user with ID ${id}`);
            try {
                const existingUser = yield this.prisma.user.findUnique({
                    where: { id },
                });
                if (!existingUser) {
                    logger_1.default.debug(`User with ID ${id} not found for update`);
                    return null;
                }
                // @ts-ignore - Ignora errore di tipo per Partial<UserProps>
                const updatedUser = yield this.prisma.user.update({
                    where: { id },
                    data,
                });
                logger_1.default.debug(`Updated user with ID ${id}`);
                return this.mapToDomain(updatedUser);
            }
            catch (error) {
                logger_1.default.error(`Error updating user with ID ${id}:`, error);
                throw error;
            }
        });
    }
    /**
     * Delete a user
     */
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.debug(`Deleting user with ID ${id}`);
            try {
                const user = yield this.prisma.user.findUnique({
                    where: { id },
                });
                if (!user) {
                    logger_1.default.debug(`User with ID ${id} not found for deletion`);
                    return false;
                }
                yield this.prisma.user.delete({
                    where: { id },
                });
                logger_1.default.debug(`Deleted user with ID ${id}`);
                return true;
            }
            catch (error) {
                logger_1.default.error(`Error deleting user with ID ${id}:`, error);
                throw error;
            }
        });
    }
    /**
     * Find users by workspace ID
     */
    findByWorkspace(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.debug(`Finding users for workspace ${workspaceId}`);
            try {
                // @ts-ignore - Ignora errore di workspaceId non esistente in UserWhereInput
                const users = yield this.prisma.user.findMany({
                    where: { workspaceId },
                    orderBy: { createdAt: 'asc' },
                });
                logger_1.default.debug(`Found ${users.length} users for workspace ${workspaceId}`);
                return users.map(user => this.mapToDomain(user));
            }
            catch (error) {
                logger_1.default.error(`Error finding users for workspace ${workspaceId}:`, error);
                throw error;
            }
        });
    }
    /**
     * Verify user's email
     */
    verifyEmail(id) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.debug(`Verifying email for user with ID ${id}`);
            try {
                const user = yield this.prisma.user.findUnique({
                    where: { id },
                });
                if (!user) {
                    logger_1.default.debug(`User with ID ${id} not found for email verification`);
                    return null;
                }
                // @ts-ignore - Ignora errore su proprietà isVerified non esistente
                const updatedUser = yield this.prisma.user.update({
                    where: { id },
                    data: { status: 'ACTIVE' },
                });
                logger_1.default.debug(`Email verified for user with ID ${id}`);
                return this.mapToDomain(updatedUser);
            }
            catch (error) {
                logger_1.default.error(`Error verifying email for user with ID ${id}:`, error);
                throw error;
            }
        });
    }
    /**
     * Update last login time
     */
    updateLastLogin(id) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.debug(`Updating last login for user with ID ${id}`);
            try {
                const user = yield this.prisma.user.findUnique({
                    where: { id },
                });
                if (!user) {
                    logger_1.default.debug(`User with ID ${id} not found for updating last login`);
                    return null;
                }
                const updatedUser = yield this.prisma.user.update({
                    where: { id },
                    data: { lastLogin: new Date() },
                });
                logger_1.default.debug(`Last login updated for user with ID ${id}`);
                return this.mapToDomain(updatedUser);
            }
            catch (error) {
                logger_1.default.error(`Error updating last login for user with ID ${id}:`, error);
                throw error;
            }
        });
    }
}
exports.UserRepository = UserRepository;
//# sourceMappingURL=user.repository.js.map