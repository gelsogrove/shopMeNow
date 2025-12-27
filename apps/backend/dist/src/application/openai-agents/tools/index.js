"use strict";
/**
 * OpenAI Agents SDK - Tools Index
 *
 * Central export for all agent tools.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportAgentTools = exports.orderAgentTools = exports.cartAgentTools = exports.productAgentTools = exports.allTools = void 0;
__exportStar(require("./product.tools"), exports);
__exportStar(require("./cart.tools"), exports);
__exportStar(require("./order.tools"), exports);
__exportStar(require("./support.tools"), exports);
// Combined tool sets for different agent types
const product_tools_1 = require("./product.tools");
const cart_tools_1 = require("./cart.tools");
const order_tools_1 = require("./order.tools");
const support_tools_1 = require("./support.tools");
/**
 * All tools for the triage agent (can access everything)
 */
exports.allTools = [
    ...product_tools_1.productTools,
    ...cart_tools_1.cartTools,
    ...order_tools_1.orderTools,
    ...support_tools_1.supportTools,
];
/**
 * Tools for product-focused agents
 */
exports.productAgentTools = product_tools_1.productTools;
/**
 * Tools for cart-focused agents
 */
exports.cartAgentTools = [
    ...cart_tools_1.cartTools,
    ...product_tools_1.productTools.slice(0, 2), // search and details only
];
/**
 * Tools for order-focused agents
 */
exports.orderAgentTools = order_tools_1.orderTools;
/**
 * Tools for support-focused agents
 */
exports.supportAgentTools = support_tools_1.supportTools;
//# sourceMappingURL=index.js.map