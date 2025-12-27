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
exports.createUserRouter = void 0;
const express_1 = require("express");
const user_service_1 = require("../../../application/services/user.service");
const user_unsubscribe_service_1 = require("../../../services/user-unsubscribe.service");
const database_1 = require("@echatbot/database");
const logger_1 = __importDefault(require("../../../utils/logger"));
const user_controller_1 = require("../controllers/user.controller");
const async_middleware_1 = require("../middlewares/async.middleware");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const uploadMiddleware_1 = require("../middlewares/uploadMiddleware");
/**
 * Create user router
 */
const createUserRouter = () => {
    const router = (0, express_1.Router)();
    const userService = new user_service_1.UserService();
    const userController = new user_controller_1.UserController(userService);
    const unsubscribeService = new user_unsubscribe_service_1.UserUnsubscribeService(database_1.prisma);
    logger_1.default.info('Setting up user routes');
    router.use(auth_middleware_1.authMiddleware);
    // Get current user
    router.get('/me', (0, async_middleware_1.asyncHandler)(userController.getCurrentUser));
    // Get current user's profile (alias for /me)
    router.get('/profile', (0, async_middleware_1.asyncHandler)(userController.getCurrentUser));
    // Update current user's profile (with optional logo upload)
    router.put('/profile', uploadMiddleware_1.uploadImage.single('logo'), uploadMiddleware_1.handleUploadError, (0, async_middleware_1.asyncHandler)(userController.updateProfile));
    // Change current user's password
    router.post('/change-password', (0, async_middleware_1.asyncHandler)(userController.changePassword));
    /**
     * @swagger
     * /users/me/delete:
     *   post:
     *     summary: Delete current user account (soft-delete)
     *     description: |
     *       Soft-deletes the current user's account with 90-day retention.
     *       - Owner: Deletes workspace + all customers + orders (cascade)
     *       - Agent: Deletes only user account (isolated)
     *     tags: [Users]
     *     requestBody:
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               reason:
     *                 type: string
     *                 default: "User requested deletion"
     *     responses:
     *       200:
     *         description: Account soft-deleted successfully
     */
    router.post('/me/delete', (0, async_middleware_1.asyncHandler)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        const { reason = "User requested deletion" } = req.body;
        try {
            const result = yield unsubscribeService.unsubscribeUser(userId, reason);
            logger_1.default.info(`User ${userId} deleted their account`, { cascadeType: result.cascadeType });
            return res.json(result);
        }
        catch (error) {
            logger_1.default.error(`Failed to delete user account ${userId}`, error);
            return res.status(500).json({
                error: "Failed to delete account",
                message: error.message
            });
        }
    })));
    // Get all users
    router.get('/', (0, async_middleware_1.asyncHandler)(userController.getAllUsers));
    // Get a specific user
    router.get('/:id', (0, async_middleware_1.asyncHandler)(userController.getUserById));
    // Create a new user (admin only)
    router.post('/', (0, async_middleware_1.asyncHandler)(userController.createUser));
    // Update a user
    router.put('/:id', (0, async_middleware_1.asyncHandler)(userController.updateUser));
    // Delete a user (admin only)
    router.delete('/:id', (0, async_middleware_1.asyncHandler)(userController.deleteUser));
    logger_1.default.info('User routes setup complete');
    return router;
};
exports.createUserRouter = createUserRouter;
//# sourceMappingURL=user.routes.js.map