"use strict";
/**
 * PromptBuilder Module - Dynamic Prompt Generation System
 *
 * This module is THE HEART of the AI chatbot system.
 * It generates prompts dynamically at runtime based on workspace configuration.
 *
 * Usage:
 * ```typescript
 * import { PromptBuilderService } from "./prompt-builder"
 *
 * const promptBuilder = new PromptBuilderService(prisma)
 * const prompt = await promptBuilder.build("ROUTER", { workspaceId, customerId })
 * ```
 *
 * @module prompt-builder
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VariableResolverService = exports.TemplateEngineService = exports.TemplateLoaderService = exports.PromptBuilderService = void 0;
var prompt_builder_service_1 = require("./prompt-builder.service");
Object.defineProperty(exports, "PromptBuilderService", { enumerable: true, get: function () { return prompt_builder_service_1.PromptBuilderService; } });
var template_loader_service_1 = require("./template-loader.service");
Object.defineProperty(exports, "TemplateLoaderService", { enumerable: true, get: function () { return template_loader_service_1.TemplateLoaderService; } });
var template_engine_service_1 = require("./template-engine.service");
Object.defineProperty(exports, "TemplateEngineService", { enumerable: true, get: function () { return template_engine_service_1.TemplateEngineService; } });
var variable_resolver_service_1 = require("./variable-resolver.service");
Object.defineProperty(exports, "VariableResolverService", { enumerable: true, get: function () { return variable_resolver_service_1.VariableResolverService; } });
//# sourceMappingURL=index.js.map