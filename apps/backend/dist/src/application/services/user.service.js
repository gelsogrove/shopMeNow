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
exports.UserService = void 0;
const user_entity_1 = require("../../domain/entities/user.entity");
const user_repository_1 = require("../../repositories/user.repository");
const logger_1 = __importDefault(require("../../utils/logger"));
const password_1 = require("../../utils/password");
class UserService {
    constructor(prisma) {
        this.repository = new user_repository_1.UserRepository(prisma);
    }
    /**
     * Get a user by ID
     */
    getById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info(`Getting user by ID: ${id}`);
            return this.repository.findById(id);
        });
    }
    /**
     * Get a user by email
     */
    getByEmail(email) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info(`Getting user by email: ${email}`);
            return this.repository.findByEmail(email);
        });
    }
    /**
     * Create a new user
     */
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info(`Creating new user with email: ${data.email}`);
            // Check if user already exists
            const existingUser = yield this.repository.findByEmail(data.email);
            if (existingUser) {
                logger_1.default.error(`User with email ${data.email} already exists`);
                throw new Error('User with this email already exists');
            }
            // Hash the password if provided
            if (data.password) {
                data.password = yield (0, password_1.hashPassword)(data.password);
            }
            // Create user entity
            const user = user_entity_1.User.create(data);
            // Save to repository
            return this.repository.create(user);
        });
    }
    /**
     * Update a user
     */
    update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info(`Updating user with ID: ${id}`);
            // Hash password if it's being updated
            if (data.password) {
                data.password = yield (0, password_1.hashPassword)(data.password);
            }
            return this.repository.update(id, data);
        });
    }
    /**
     * Delete a user
     */
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info(`Deleting user with ID: ${id}`);
            return this.repository.delete(id);
        });
    }
    /**
     * Authenticate a user
     */
    authenticate(email, password) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info(`Authenticating user with email: ${email}`);
            const user = yield this.repository.findByEmail(email);
            if (!user || !user.password) {
                logger_1.default.debug(`Authentication failed for email: ${email} - User not found or no password`);
                return null;
            }
            const passwordMatches = yield (0, password_1.comparePassword)(password, user.password);
            if (!passwordMatches) {
                logger_1.default.debug(`Authentication failed for email: ${email} - Password doesn't match`);
                return null;
            }
            // Update last login time
            yield this.repository.updateLastLogin(user.id);
            logger_1.default.info(`User ${email} authenticated successfully`);
            return user;
        });
    }
    /**
     * Verify a user's email
     */
    verifyEmail(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info(`Verifying email for user ID: ${userId}`);
            return this.repository.verifyEmail(userId);
        });
    }
    /**
     * Get all users for a workspace
     */
    getUsersByWorkspace(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info(`Getting users for workspace: ${workspaceId}`);
            return this.repository.findByWorkspace(workspaceId);
        });
    }
    /**
     * Get all users
     */
    getAllUsers() {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info('Getting all users');
            return this.repository.findAll();
        });
    }
}
exports.UserService = UserService;
//# sourceMappingURL=user.service.js.map