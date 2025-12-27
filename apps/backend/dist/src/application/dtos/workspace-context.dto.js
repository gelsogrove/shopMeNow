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
exports.WorkspaceContextDTO = void 0;
const class_validator_1 = require("class-validator");
/**
 * WorkspaceContextDTO
 * Standardized DTO for workspace identification across the application
 */
class WorkspaceContextDTO {
    constructor(workspaceId) {
        this.workspaceId = workspaceId;
    }
    /**
     * Verifica se il workspaceId è valido
     * @returns true se il workspaceId è una stringa valida e non vuota
     */
    isValid() {
        return typeof this.workspaceId === 'string' && this.workspaceId.trim() !== '';
    }
    /**
     * Factory method to create a WorkspaceContextDTO from various request sources
     * @param req Express Request object
     * @returns WorkspaceContextDTO or null if no workspaceId is found
     */
    static fromRequest(req) {
        var _a, _b, _c, _d;
        // Try to get workspaceId from different sources
        const workspaceId = ((_a = req.params) === null || _a === void 0 ? void 0 : _a.workspaceId) ||
            ((_b = req.query) === null || _b === void 0 ? void 0 : _b.workspaceId) ||
            ((_c = req.body) === null || _c === void 0 ? void 0 : _c.workspaceId) ||
            ((_d = req.headers) === null || _d === void 0 ? void 0 : _d['x-workspace-id']);
        if (!workspaceId) {
            return null;
        }
        return new WorkspaceContextDTO(workspaceId);
    }
}
exports.WorkspaceContextDTO = WorkspaceContextDTO;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], WorkspaceContextDTO.prototype, "workspaceId", void 0);
//# sourceMappingURL=workspace-context.dto.js.map