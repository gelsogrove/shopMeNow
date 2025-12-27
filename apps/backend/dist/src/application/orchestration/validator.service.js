"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MixerValidatorService = void 0;
/**
 * Lightweight structured validator to enforce basic completeness
 * and avoid barren menu-like responses.
 */
class MixerValidatorService {
    validate(output) {
        const reasons = [];
        if (!output.intro && !output.productGroups && !output.faqSections) {
            reasons.push("empty_response");
        }
        if (output.productGroups && output.productGroups.length === 1) {
            const group = output.productGroups[0];
            if (!group.items || group.items.length === 0) {
                reasons.push("single_group_without_items");
            }
        }
        if (output.questions && output.questions.length > 3) {
            reasons.push("too_many_questions");
        }
        return { valid: reasons.length === 0, reasons: reasons.length ? reasons : undefined };
    }
}
exports.MixerValidatorService = MixerValidatorService;
//# sourceMappingURL=validator.service.js.map