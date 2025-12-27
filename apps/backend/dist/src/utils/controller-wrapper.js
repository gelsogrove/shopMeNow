"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrapController = wrapController;
/**
 * Wrapper per convertire una funzione controller in un RequestHandler
 * Evita di usare "as unknown as RequestHandler"
 */
function wrapController(controllerFn) {
    return (req, res, next) => {
        return Promise.resolve(controllerFn(req, res, next)).catch(next);
    };
}
//# sourceMappingURL=controller-wrapper.js.map