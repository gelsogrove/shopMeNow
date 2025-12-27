"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncMiddleware = void 0;
const asyncMiddleware = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
exports.asyncMiddleware = asyncMiddleware;
//# sourceMappingURL=async.middleware.js.map