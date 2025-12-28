"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Agent = void 0;
const entity_1 = require("./entity");
class Agent extends entity_1.Entity {
    get id() {
        return this.props.id || '';
    }
    get name() {
        return this.props.name;
    }
    get content() {
        return this.props.content;
    }
    get isActive() {
        var _a;
        return (_a = this.props.isActive) !== null && _a !== void 0 ? _a : true;
    }
    get isRouter() {
        var _a;
        return (_a = this.props.isRouter) !== null && _a !== void 0 ? _a : false;
    }
    get department() {
        return this.props.department;
    }
    get workspaceId() {
        return this.props.workspaceId;
    }
    get temperature() {
        return this.props.temperature;
    }
    get top_p() {
        return this.props.top_p;
    }
    get top_k() {
        return this.props.top_k;
    }
    get model() {
        return this.props.model;
    }
    get max_tokens() {
        return this.props.max_tokens;
    }
    get createdAt() {
        return this.props.createdAt;
    }
    get updatedAt() {
        return this.props.updatedAt;
    }
    static create(props) {
        // Validations
        if (!props.name || props.name.trim().length === 0) {
            throw new Error('Agent name is required');
        }
        if (!props.workspaceId) {
            throw new Error('WorkspaceId is required');
        }
        // Create the agent entity
        return new Agent(props);
    }
}
exports.Agent = Agent;
//# sourceMappingURL=agent.entity.js.map