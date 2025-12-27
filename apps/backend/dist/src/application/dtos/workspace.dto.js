"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateWorkspaceDTO = exports.CreateWorkspaceDTO = exports.WorkspaceDTO = exports.WorkspaceSettingsDTO = exports.WorkspaceSocialDTO = exports.WorkspaceContactDTO = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const base_dto_1 = require("./base.dto");
/**
 * WorkspaceContactDTO - Contact information for workspace
 */
class WorkspaceContactDTO {
}
exports.WorkspaceContactDTO = WorkspaceContactDTO;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], WorkspaceContactDTO.prototype, "phoneNumber", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], WorkspaceContactDTO.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], WorkspaceContactDTO.prototype, "address", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], WorkspaceContactDTO.prototype, "city", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], WorkspaceContactDTO.prototype, "zipCode", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], WorkspaceContactDTO.prototype, "country", void 0);
/**
 * WorkspaceSocialDTO - Social media links for workspace
 */
class WorkspaceSocialDTO {
}
exports.WorkspaceSocialDTO = WorkspaceSocialDTO;
__decorate([
    (0, class_validator_1.IsUrl)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], WorkspaceSocialDTO.prototype, "website", void 0);
__decorate([
    (0, class_validator_1.IsUrl)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], WorkspaceSocialDTO.prototype, "facebook", void 0);
__decorate([
    (0, class_validator_1.IsUrl)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], WorkspaceSocialDTO.prototype, "instagram", void 0);
__decorate([
    (0, class_validator_1.IsUrl)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], WorkspaceSocialDTO.prototype, "twitter", void 0);
__decorate([
    (0, class_validator_1.IsUrl)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], WorkspaceSocialDTO.prototype, "linkedIn", void 0);
/**
 * WorkspaceSettingsDTO - Settings for workspace
 */
class WorkspaceSettingsDTO {
}
exports.WorkspaceSettingsDTO = WorkspaceSettingsDTO;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], WorkspaceSettingsDTO.prototype, "timezone", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], WorkspaceSettingsDTO.prototype, "language", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], WorkspaceSettingsDTO.prototype, "enableNotifications", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], WorkspaceSettingsDTO.prototype, "enableAgentTyping", void 0);
/**
 * WorkspaceDTO - Main workspace data transfer object
 */
class WorkspaceDTO extends base_dto_1.BaseDTO {
    constructor() {
        super(...arguments);
        this.isActive = true;
    }
}
exports.WorkspaceDTO = WorkspaceDTO;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], WorkspaceDTO.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], WorkspaceDTO.prototype, "slug", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], WorkspaceDTO.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], WorkspaceDTO.prototype, "logoUrl", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], WorkspaceDTO.prototype, "isActive", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], WorkspaceDTO.prototype, "ownerId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], WorkspaceDTO.prototype, "whatsappPhoneNumber", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], WorkspaceDTO.prototype, "whatsappApiToken", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], WorkspaceDTO.prototype, "whatsappWebhookUrl", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], WorkspaceDTO.prototype, "url", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => WorkspaceContactDTO),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", WorkspaceContactDTO)
], WorkspaceDTO.prototype, "contact", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => WorkspaceSocialDTO),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", WorkspaceSocialDTO)
], WorkspaceDTO.prototype, "social", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => WorkspaceSettingsDTO),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", WorkspaceSettingsDTO)
], WorkspaceDTO.prototype, "settings", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], WorkspaceDTO.prototype, "memberIds", void 0);
/**
 * CreateWorkspaceDTO - DTO for creating a new workspace
 */
class CreateWorkspaceDTO {
}
exports.CreateWorkspaceDTO = CreateWorkspaceDTO;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateWorkspaceDTO.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateWorkspaceDTO.prototype, "slug", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateWorkspaceDTO.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateWorkspaceDTO.prototype, "logoUrl", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateWorkspaceDTO.prototype, "whatsappPhoneNumber", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateWorkspaceDTO.prototype, "whatsappApiToken", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateWorkspaceDTO.prototype, "whatsappWebhookUrl", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreateWorkspaceDTO.prototype, "isActive", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateWorkspaceDTO.prototype, "url", void 0);
/**
 * UpdateWorkspaceDTO - DTO for updating a workspace
 */
class UpdateWorkspaceDTO {
}
exports.UpdateWorkspaceDTO = UpdateWorkspaceDTO;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateWorkspaceDTO.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateWorkspaceDTO.prototype, "slug", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateWorkspaceDTO.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateWorkspaceDTO.prototype, "logoUrl", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateWorkspaceDTO.prototype, "whatsappPhoneNumber", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateWorkspaceDTO.prototype, "whatsappApiToken", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateWorkspaceDTO.prototype, "whatsappWebhookUrl", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], UpdateWorkspaceDTO.prototype, "isActive", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateWorkspaceDTO.prototype, "url", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => WorkspaceContactDTO),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", WorkspaceContactDTO)
], UpdateWorkspaceDTO.prototype, "contact", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => WorkspaceSocialDTO),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", WorkspaceSocialDTO)
], UpdateWorkspaceDTO.prototype, "social", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => WorkspaceSettingsDTO),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", WorkspaceSettingsDTO)
], UpdateWorkspaceDTO.prototype, "settings", void 0);
//# sourceMappingURL=workspace.dto.js.map