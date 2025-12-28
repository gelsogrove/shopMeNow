"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Entity = void 0;
/**
 * Abstract base entity class
 * Provides common functionality for all domain entities
 */
class Entity {
    constructor(props) {
        this.props = props;
    }
    equals(entity) {
        if (entity === null || entity === undefined) {
            return false;
        }
        if (this === entity) {
            return true;
        }
        return JSON.stringify(this.props) === JSON.stringify(entity.props);
    }
}
exports.Entity = Entity;
//# sourceMappingURL=entity.js.map