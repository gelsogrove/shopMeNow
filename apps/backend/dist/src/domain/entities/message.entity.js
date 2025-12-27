"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Message = exports.MessageRole = void 0;
const entity_1 = require("./entity");
var MessageRole;
(function (MessageRole) {
    MessageRole["USER"] = "user";
    MessageRole["ASSISTANT"] = "assistant";
    MessageRole["SYSTEM"] = "system";
})(MessageRole || (exports.MessageRole = MessageRole = {}));
class Message extends entity_1.Entity {
    get id() {
        return this.props.id || '';
    }
    get chatId() {
        return this.props.chatId;
    }
    get content() {
        return this.props.content;
    }
    get role() {
        return this.props.role;
    }
    get createdAt() {
        return this.props.createdAt;
    }
    get updatedAt() {
        return this.props.updatedAt;
    }
    get metadata() {
        return this.props.metadata;
    }
    get userId() {
        return this.props.userId;
    }
    get agentId() {
        return this.props.agentId;
    }
    static create(props) {
        // Validations
        if (!props.chatId) {
            throw new Error('Chat ID is required');
        }
        if (!props.content) {
            throw new Error('Message content is required');
        }
        if (!Object.values(MessageRole).includes(props.role)) {
            throw new Error('Invalid message role');
        }
        return new Message(props);
    }
}
exports.Message = Message;
//# sourceMappingURL=message.entity.js.map