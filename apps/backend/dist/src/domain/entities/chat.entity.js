"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Chat = void 0;
const entity_1 = require("./entity");
class Chat extends entity_1.Entity {
    get id() {
        return this.props.id || '';
    }
    get title() {
        return this.props.title;
    }
    get workspaceId() {
        return this.props.workspaceId;
    }
    get userId() {
        return this.props.userId;
    }
    get createdAt() {
        return this.props.createdAt;
    }
    get updatedAt() {
        return this.props.updatedAt;
    }
    get isCompleted() {
        var _a;
        return (_a = this.props.isCompleted) !== null && _a !== void 0 ? _a : false;
    }
    get agentId() {
        return this.props.agentId;
    }
    get customerId() {
        return this.props.customerId;
    }
    get metadata() {
        return this.props.metadata;
    }
    static create(props) {
        // Validations
        if (!props.workspaceId) {
            throw new Error('Workspace ID is required');
        }
        return new Chat(props);
    }
}
exports.Chat = Chat;
//# sourceMappingURL=chat.entity.js.map