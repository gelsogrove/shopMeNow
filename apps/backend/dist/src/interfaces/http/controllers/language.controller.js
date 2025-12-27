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
exports.LanguageController = void 0;
const logger_1 = __importDefault(require("../../../utils/logger"));
const database_1 = require("@echatbot/database");
class LanguageController {
    constructor(prismaInstance) {
        /**
         * Get all active languages for a workspace
         */
        this.getAllLanguages = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const workspaceId = req.headers['x-workspace-id'] || req.query.workspaceId;
                if (!workspaceId) {
                    logger_1.default.error('Workspace ID is required for languages');
                    return res.status(400).json({ error: 'Workspace ID is required' });
                }
                const languages = yield this.prisma.languages.findMany({
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        isDefault: true,
                    },
                    where: {
                        isActive: true,
                        workspaceId: workspaceId
                    },
                    orderBy: {
                        name: 'asc',
                    },
                });
                logger_1.default.debug(`Retrieved ${languages.length} languages for workspace ${workspaceId}`);
                return res.status(200).json({
                    languages: languages,
                });
            }
            catch (error) {
                logger_1.default.error('Error fetching languages:', error);
                return res.status(500).json({ error: 'Failed to fetch languages' });
            }
        });
        this.prisma = prismaInstance || database_1.prisma;
    }
}
exports.LanguageController = LanguageController;
//# sourceMappingURL=language.controller.js.map