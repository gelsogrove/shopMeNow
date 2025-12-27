"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.UserController = void 0;
const user_service_1 = require("../../../application/services/user.service");
const logger_1 = __importDefault(require("../../../utils/logger"));
class UserController {
    constructor(userService) {
        /**
         * Get the currently authenticated user
         */
        this.getCurrentUser = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                if (!userId) {
                    return res.status(401).json({ message: "Unauthorized" });
                }
                const user = yield this.userService.getById(userId);
                if (!user) {
                    return res.status(404).json({ message: "User not found" });
                }
                // Don't return the password
                const userWithoutPassword = {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                    isVerified: user.isVerified,
                    workspaceId: user.workspaceId,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt,
                    lastLogin: user.lastLogin,
                    authProvider: user.authProvider || "email",
                    hasPassword: !!user.passwordHash,
                    language: user.language || "ENG",
                    // 📱 Personal phone (optional)
                    phoneNumber: user.phoneNumber,
                    // 🧾 Billing fields
                    companyName: user.companyName,
                    vatNumber: user.vatNumber,
                    website: user.website,
                    billingPhone: user.billingPhone,
                    billingAddress: user.billingAddress,
                    // 🖼️ Company logo
                    logo: user.logo,
                };
                return res.json(userWithoutPassword);
            }
            catch (error) {
                logger_1.default.error('Error fetching current user:', error);
                return next(error);
            }
        });
        /**
         * Get all users
         */
        this.getAllUsers = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            try {
                // Check if we need to filter by workspace
                const workspaceId = req.query.workspaceId;
                let users;
                if (workspaceId) {
                    users = yield this.userService.getUsersByWorkspace(workspaceId);
                }
                else {
                    users = yield this.userService.getAllUsers();
                }
                // Don't return passwords
                const usersWithoutPasswords = users.map(user => ({
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    isVerified: user.isVerified,
                    workspaceId: user.workspaceId,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt,
                    lastLogin: user.lastLogin
                }));
                return res.json(usersWithoutPasswords);
            }
            catch (error) {
                logger_1.default.error('Error fetching users:', error);
                return next(error);
            }
        });
        /**
         * Get a specific user by ID
         */
        this.getUserById = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const user = yield this.userService.getById(id);
                if (!user) {
                    return res.status(404).json({ message: "User not found" });
                }
                // Don't return the password
                const userWithoutPassword = {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    isVerified: user.isVerified,
                    workspaceId: user.workspaceId,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt,
                    lastLogin: user.lastLogin
                };
                return res.json(userWithoutPassword);
            }
            catch (error) {
                logger_1.default.error(`Error fetching user ${req.params.id}:`, error);
                return next(error);
            }
        });
        /**
         * Create a new user
         */
        this.createUser = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            try {
                const userData = req.body;
                const user = yield this.userService.create(userData);
                // Don't return the password
                const userWithoutPassword = {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    isVerified: user.isVerified,
                    workspaceId: user.workspaceId,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt,
                    lastLogin: user.lastLogin
                };
                return res.status(201).json(userWithoutPassword);
            }
            catch (error) {
                logger_1.default.error('Error creating user:', error);
                if (error instanceof Error && error.message.includes('already exists')) {
                    return res.status(409).json({ message: error.message });
                }
                return next(error);
            }
        });
        /**
         * Update a user
         */
        this.updateUser = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const userData = req.body;
                logger_1.default.info(`Updating user with ID: ${id}`);
                const user = yield this.userService.update(id, userData);
                if (!user) {
                    return res.status(404).json({ message: "User not found" });
                }
                // Don't return the password
                const userWithoutPassword = {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    isVerified: user.isVerified,
                    workspaceId: user.workspaceId,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt,
                    lastLogin: user.lastLogin
                };
                return res.json(userWithoutPassword);
            }
            catch (error) {
                logger_1.default.error(`Error updating user ${req.params.id}:`, error);
                return next(error);
            }
        });
        /**
         * Update current user's profile
         */
        this.updateProfile = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                const userData = req.body;
                if (!userId) {
                    return res.status(401).json({ message: "Unauthorized" });
                }
                logger_1.default.info(`Updating profile for user ID: ${userId}`);
                logger_1.default.info(`🔍 Request body received:`, JSON.stringify(userData, null, 2));
                // Handle logo upload if present
                if (req.file) {
                    userData.logo = `/uploads/users/${req.file.filename}`;
                    logger_1.default.info(`📸 Logo uploaded: ${userData.logo}`);
                }
                // Handle logo removal (when removeLogo is sent)
                if (userData.removeLogo === 'true' || userData.removeLogo === true) {
                    userData.logo = null;
                    delete userData.removeLogo;
                    logger_1.default.info(`🗑️ Logo removed for user ${userId}`);
                }
                const user = yield this.userService.update(userId, userData);
                if (!user) {
                    return res.status(404).json({ message: "User not found" });
                }
                logger_1.default.info(`✅ User updated successfully:`, {
                    id: user.id,
                    phoneNumber: user.phoneNumber,
                    language: user.language,
                    companyName: user.companyName,
                    vatNumber: user.vatNumber,
                    website: user.website,
                    billingPhone: user.billingPhone,
                    billingAddress: user.billingAddress,
                    logo: user.logo,
                });
                // Don't return the password
                const userWithoutPassword = {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                    isVerified: user.isVerified,
                    workspaceId: user.workspaceId,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt,
                    lastLogin: user.lastLogin,
                    // 📱 Personal phone (optional)
                    phoneNumber: user.phoneNumber,
                    // 🌐 Language preference
                    language: user.language || "ENG",
                    // 🧾 Billing fields (Andrea's requirement)
                    companyName: user.companyName,
                    vatNumber: user.vatNumber,
                    website: user.website,
                    billingPhone: user.billingPhone,
                    billingAddress: user.billingAddress,
                    // 🖼️ Company logo
                    logo: user.logo,
                };
                return res.json(userWithoutPassword);
            }
            catch (error) {
                logger_1.default.error(`Error updating profile for user ${(_b = req.user) === null || _b === void 0 ? void 0 : _b.id}:`, error);
                return next(error);
            }
        });
        /**
         * Change current user's password
         */
        this.changePassword = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                const { currentPassword, newPassword } = req.body;
                if (!userId) {
                    return res.status(401).json({ message: "Unauthorized" });
                }
                if (!currentPassword || !newPassword) {
                    return res.status(400).json({ message: "Current password and new password are required" });
                }
                logger_1.default.info(`Changing password for user ID: ${userId}`);
                // Get the current user to verify the current password
                const user = yield this.userService.getById(userId);
                if (!user) {
                    return res.status(404).json({ message: "User not found" });
                }
                // Verify current password (use passwordHash from entity)
                const { comparePassword } = yield Promise.resolve().then(() => __importStar(require('../../../utils/password')));
                const passwordHash = ((_b = user.props) === null || _b === void 0 ? void 0 : _b.password) || user.password;
                if (!passwordHash || !(yield comparePassword(currentPassword, passwordHash))) {
                    return res.status(400).json({ message: "Current password is incorrect" });
                }
                // Update password (will be hashed by service)
                const updatedUser = yield this.userService.update(userId, { password: newPassword });
                if (!updatedUser) {
                    return res.status(404).json({ message: "User not found" });
                }
                return res.json({ message: "Password changed successfully" });
            }
            catch (error) {
                logger_1.default.error(`Error changing password for user ${(_c = req.user) === null || _c === void 0 ? void 0 : _c.id}:`, error);
                return next(error);
            }
        });
        /**
         * Delete a user
         */
        this.deleteUser = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const result = yield this.userService.delete(id);
                if (!result) {
                    return res.status(404).json({ message: "User not found" });
                }
                return res.status(204).send();
            }
            catch (error) {
                logger_1.default.error(`Error deleting user ${req.params.id}:`, error);
                return next(error);
            }
        });
        this.userService = userService || new user_service_1.UserService();
    }
}
exports.UserController = UserController;
//# sourceMappingURL=user.controller.js.map