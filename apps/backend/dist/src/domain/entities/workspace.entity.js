"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Workspace = void 0;
const entity_1 = require("./entity");
class Workspace extends entity_1.Entity {
    constructor(props) {
        super(props);
    }
    static create(props) {
        return new Workspace(props);
    }
    get name() {
        return this.props.name;
    }
    get description() {
        return this.props.description;
    }
    get isActive() {
        return this.props.isActive;
    }
    get isDelete() {
        return this.props.isDelete;
    }
    get createdAt() {
        return this.props.createdAt;
    }
    get updatedAt() {
        return this.props.updatedAt;
    }
    get id() {
        return this.props.id;
    }
    get slug() {
        return this.props.slug;
    }
    get whatsappPhoneNumber() {
        return this.props.whatsappPhoneNumber;
    }
    get whatsappApiKey() {
        return this.props.whatsappApiKey;
    }
    get whatsappApiToken() {
        return this.props.whatsappApiToken;
    }
    get whatsappWebhookUrl() {
        return this.props.whatsappWebhookUrl;
    }
    get notificationEmail() {
        return this.props.notificationEmail;
    }
    get webhookUrl() {
        return this.props.webhookUrl;
    }
    get language() {
        return this.props.language;
    }
    get currency() {
        return this.props.currency;
    }
    get channelStatus() {
        return this.props.channelStatus;
    }
    get messageLimit() {
        return this.props.messageLimit;
    }
    get blocklist() {
        return this.props.blocklist;
    }
    get url() {
        return this.props.url;
    }
    get welcomeMessage() {
        return this.props.welcomeMessage;
    }
    get wipMessage() {
        return this.props.wipMessage;
    }
    get afterRegistrationMessages() {
        return this.props.afterRegistrationMessages;
    }
    get debugMode() {
        return this.props.debugMode;
    }
    get adminEmail() {
        return this.props.adminEmail;
    }
    get planType() {
        return this.props.planType;
    }
    get trialEndsAt() {
        return this.props.trialEndsAt;
    }
    get allowedExternalLinks() {
        return this.props.allowedExternalLinks;
    }
    // 🆕 Channel Configuration getters (Feature 199)
    get sellsProductsAndServices() {
        var _a;
        return (_a = this.props.sellsProductsAndServices) !== null && _a !== void 0 ? _a : true;
    }
    get hasSalesAgents() {
        var _a;
        return (_a = this.props.hasSalesAgents) !== null && _a !== void 0 ? _a : false;
    }
    get hasHumanSupport() {
        var _a;
        return (_a = this.props.hasHumanSupport) !== null && _a !== void 0 ? _a : true;
    }
    get humanSupportInstructions() {
        return this.props.humanSupportInstructions;
    }
    get frustrationEscalationInstructions() {
        return this.props.frustrationEscalationInstructions;
    }
    get operatorContactMethod() {
        return this.props.operatorContactMethod;
    }
    get operatorWhatsappNumber() {
        return this.props.operatorWhatsappNumber;
    }
    get toneOfVoice() {
        return this.props.toneOfVoice;
    }
    get botIdentityResponse() {
        return this.props.botIdentityResponse;
    }
    get address() {
        return this.props.address;
    }
    get customAiRules() {
        return this.props.customAiRules;
    }
    get logoUrl() {
        return this.props.logoUrl;
    }
    // 🆕 Translation Settings getters
    get translateProductNames() {
        var _a;
        return (_a = this.props.translateProductNames) !== null && _a !== void 0 ? _a : false;
    }
    get translateCategoryNames() {
        var _a;
        return (_a = this.props.translateCategoryNames) !== null && _a !== void 0 ? _a : false;
    }
    get translateServiceNames() {
        var _a;
        return (_a = this.props.translateServiceNames) !== null && _a !== void 0 ? _a : true;
    }
    get catalogBaseLanguage() {
        var _a;
        return (_a = this.props.catalogBaseLanguage) !== null && _a !== void 0 ? _a : "it";
    }
    // Business methods
    activate() {
        this.props.isActive = true;
        this.props.updatedAt = new Date();
    }
    deactivate() {
        this.props.isActive = false;
        this.props.updatedAt = new Date();
    }
    softDelete() {
        this.props.isDelete = true;
        this.props.isActive = false;
        this.props.updatedAt = new Date();
    }
    updateName(name) {
        this.props.name = name;
        this.props.updatedAt = new Date();
    }
    updateDescription(description) {
        this.props.description = description;
        this.props.updatedAt = new Date();
    }
}
exports.Workspace = Workspace;
//# sourceMappingURL=workspace.entity.js.map