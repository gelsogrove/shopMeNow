"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.workspaceCustomersRouter = exports.customersRouter = void 0;
const express_1 = require("express");
const logger_1 = __importDefault(require("../../../utils/logger"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const billing_middleware_1 = require("../middlewares/billing.middleware");
// Router per il mounting principale
const customersRouter = (controller) => {
    const router = (0, express_1.Router)();
    // 🔒 SECURITY: All routes require authentication
    router.use(auth_middleware_1.authMiddleware);
    logger_1.default.info("Setting up customers routes");
    // Routes for customers - adjust paths to work with the router mounting
    router.get("/:workspaceId/customers", controller.getCustomersForWorkspace.bind(controller));
    // 💰 BILLING: Check plan limits before creating a customer
    router.post("/:workspaceId/customers", (0, billing_middleware_1.checkPlanLimits)("customers"), controller.createCustomer.bind(controller));
    router.get("/:workspaceId/customers/:id", controller.getCustomerById.bind(controller));
    router.put("/:workspaceId/customers/:id", controller.updateCustomer.bind(controller));
    router.delete("/:workspaceId/customers/:id", controller.deleteCustomer.bind(controller));
    router.post("/:workspaceId/customers/:id/block", controller.blockCustomer.bind(controller));
    router.post("/:workspaceId/customers/:id/unblock", controller.unblockCustomer.bind(controller));
    // Endpoint alternativo che supporta anche 'bloc' (senza 'k')
    router.post("/:workspaceId/customers/:id/bloc", controller.blockCustomer.bind(controller));
    // TASK 3: Operator Control Release Mechanism
    router.put("/:workspaceId/customers/:customerId/chatbot-control", controller.updateChatbotControl.bind(controller));
    // Validation endpoints for frontend real-time validation
    router.get("/:workspaceId/customers/check-phone", controller.checkPhoneExists.bind(controller));
    router.get("/:workspaceId/customers/check-email", controller.checkEmailExists.bind(controller));
    // Route for counting unknown customers
    router.get("/:workspaceId/unknown-customers/count", (req, res, next) => {
        logger_1.default.info(`💡 Processing request for unknown-customers count with workspace: ${req.params.workspaceId}`);
        return controller.countUnknownCustomers(req, res, next);
    });
    // 🗑️ Delete a registration attempt (blocked unregistered user)
    router.delete("/:workspaceId/registration-attempts/:attemptId", controller.deleteRegistrationAttempt.bind(controller));
    logger_1.default.info("Customers routes setup complete");
    return router;
};
exports.customersRouter = customersRouter;
// Router specifico per quando è montato su /workspaces
const workspaceCustomersRouter = (controller) => {
    const router = (0, express_1.Router)();
    // All routes require authentication
    router.use(auth_middleware_1.authMiddleware);
    logger_1.default.info("Setting up workspace customers routes");
    // Routes for customers under workspaces path - prefix è già /workspaces
    router.get("/:workspaceId/customers", controller.getCustomersForWorkspace.bind(controller));
    router.post("/:workspaceId/customers", controller.createCustomer.bind(controller));
    router.get("/:workspaceId/customers/:id", controller.getCustomerById.bind(controller));
    router.put("/:workspaceId/customers/:id", controller.updateCustomer.bind(controller));
    router.delete("/:workspaceId/customers/:id", controller.deleteCustomer.bind(controller));
    router.post("/:workspaceId/customers/:id/block", controller.blockCustomer.bind(controller));
    router.post("/:workspaceId/customers/:id/unblock", controller.unblockCustomer.bind(controller));
    // Endpoint alternativo che supporta anche 'bloc' (senza 'k')
    router.post("/:workspaceId/customers/:id/bloc", controller.blockCustomer.bind(controller));
    // TASK 3: Operator Control Release Mechanism
    router.put("/:workspaceId/customers/:customerId/chatbot-control", controller.updateChatbotControl.bind(controller));
    // Route for counting unknown customers (workspace specific)
    router.get("/:workspaceId/unknown-customers/count", controller.countUnknownCustomers.bind(controller));
    // 🗑️ Delete a registration attempt (blocked unregistered user)
    router.delete("/:workspaceId/registration-attempts/:attemptId", controller.deleteRegistrationAttempt.bind(controller));
    logger_1.default.info("Workspace customers routes setup complete");
    return router;
};
exports.workspaceCustomersRouter = workspaceCustomersRouter;
//# sourceMappingURL=customers.routes.js.map