"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatRoundedCurrency = exports.smartRoundPrice = exports.DEFAULT_ROUNDING_STEP = void 0;
exports.DEFAULT_ROUNDING_STEP = 0.05;
/**
 * Round a numeric value to the closest multiple of the provided step.
 * Used to snap price decimals to 0 / 5 / 10 cents for a more retail-friendly experience.
 */
const smartRoundPrice = (value, step = exports.DEFAULT_ROUNDING_STEP) => {
    if (typeof value !== "number" || !isFinite(value)) {
        return 0;
    }
    const safeStep = Math.max(Math.abs(step), 0.01);
    const rounded = Math.round(value / safeStep) * safeStep;
    // Keep just two decimals to avoid floating point artifacts
    const result = Number(rounded.toFixed(2));
    return result < 0 ? 0 : result;
};
exports.smartRoundPrice = smartRoundPrice;
/**
 * Format a rounded price with currency symbol and optional locale.
 */
const formatRoundedCurrency = (value, options = {}) => {
    const { currencySymbol = "$", locale = "en-US", step = exports.DEFAULT_ROUNDING_STEP, minimumFractionDigits = 0, maximumFractionDigits = 0, useSmartRound = false, } = options;
    const rounded = useSmartRound ? (0, exports.smartRoundPrice)(value, step) : value;
    const formatter = new Intl.NumberFormat(locale, {
        minimumFractionDigits,
        maximumFractionDigits,
    });
    return `${currencySymbol}${formatter.format(rounded)}`;
};
exports.formatRoundedCurrency = formatRoundedCurrency;
//# sourceMappingURL=pricing.js.map
