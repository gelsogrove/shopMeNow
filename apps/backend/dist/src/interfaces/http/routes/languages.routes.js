"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLanguagesRouter = void 0;
const express_1 = require("express");
const logger_1 = __importDefault(require("../../../utils/logger"));
const language_controller_1 = require("../controllers/language.controller");
const async_middleware_1 = require("../middlewares/async.middleware");
const auth_middleware_1 = require("../middlewares/auth.middleware");
/**
 * @swagger
 * components:
 *   schemas:
 *     Language:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Unique identifier for the language
 *         code:
 *           type: string
 *           description: Language code (e.g., 'en', 'it')
 *         name:
 *           type: string
 *           description: Full name of the language
 *         isDefault:
 *           type: boolean
 *           description: Whether this is the default language
 */
const createLanguagesRouter = () => {
    const router = (0, express_1.Router)();
    const languageController = new language_controller_1.LanguageController();
    logger_1.default.info('Setting up languages routes');
    /**
     * @swagger
     * /api/languages:
     *   get:
     *     summary: Get all active languages for a workspace
     *     tags: [Languages]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: header
     *         name: x-workspace-id
     *         schema:
     *           type: string
     *         required: true
     *         description: ID of the workspace
     *     responses:
     *       200:
     *         description: List of languages
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 languages:
     *                   type: array
     *                   items:
     *                     $ref: '#/components/schemas/Language'
     *       400:
     *         description: Bad request, workspace ID is required
     *       500:
     *         description: Server error
     */
    router.get('/', auth_middleware_1.authMiddleware, (0, async_middleware_1.asyncHandler)(languageController.getAllLanguages));
    logger_1.default.info('Languages routes setup complete');
    return router;
};
exports.createLanguagesRouter = createLanguagesRouter;
//# sourceMappingURL=languages.routes.js.map