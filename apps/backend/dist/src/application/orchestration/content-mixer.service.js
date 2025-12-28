"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentMixerService = void 0;
const intent_types_1 = require("../intent/intent.types");
/**
 * Content mixer with deterministic guards. LLM plug-in can replace
 * the `buildNarrative` method, but the structure stays stable.
 */
class ContentMixerService {
    mix(params) {
        const productGroups = this.buildProducts(params);
        const faqSections = this.buildFaqs(params);
        const offerSections = this.buildOffers(params);
        const serviceSections = this.buildServices(params);
        const questions = this.buildQuestions(params, productGroups, faqSections);
        const registrationPrompt = !params.isRegistered && productGroups.length > 0
            ? this.buildRegistrationPrompt()
            : undefined;
        return {
            intro: this.buildIntro(params),
            productGroups: productGroups.length ? productGroups : undefined,
            faqSections: faqSections.length ? faqSections : undefined,
            offerSections: offerSections.length ? offerSections : undefined,
            serviceSections: serviceSections.length ? serviceSections : undefined,
            questions: questions.length ? questions : undefined,
            registrationPrompt,
        };
    }
    buildIntro(params) {
        var _a;
        const name = (_a = params.context.customerProfile) === null || _a === void 0 ? void 0 : _a.name;
        const greeted = params.context.workspace.toneOfVoice;
        const hasGreetingIntent = params.intents.some((i) => (0, intent_types_1.isGreetingIntent)(i.intent));
        if (hasGreetingIntent && name) {
            return `Ciao ${name}!`;
        }
        if (hasGreetingIntent) {
            return greeted ? `Ciao!` : `Ciao!`;
        }
        return undefined;
    }
    buildProducts(params) {
        if (!params.context.workspace.sellsProductsAndServices) {
            return [];
        }
        const block = params.context.products;
        if (!block || block.type !== "PRODUCTS")
            return [];
        const products = (block.products || []);
        if (!products.length)
            return [];
        // Group by category name if present, else fallback to single group
        const grouped = new Map();
        for (const p of products) {
            const key = p.categoryName || "Selezione";
            if (!grouped.has(key))
                grouped.set(key, []);
            grouped.get(key).push(p);
        }
        const groups = Array.from(grouped.entries()).map(([title, list]) => {
            const topItems = list.slice(0, 5).map((p) => {
                var _a;
                return ({
                    id: p.id,
                    name: p.name,
                    sku: p.sku,
                    price: params.isRegistered ? (_a = p.priceWithDiscount) !== null && _a !== void 0 ? _a : p.price : undefined,
                });
            });
            return {
                title,
                items: topItems,
            };
        });
        return groups;
    }
    buildFaqs(params) {
        const block = params.context.faqs;
        if (!block || block.type !== "FAQ")
            return [];
        return (block.faqs || []).map((faq) => ({
            question: faq.question,
            answer: faq.answer,
        }));
    }
    buildOffers(params) {
        const block = params.context.offers;
        if (!block || block.type !== "OFFERS")
            return [];
        return (block.offers || []).map((offer) => ({
            title: offer.name,
            description: offer.description,
            discountPercent: offer.discountPercent,
            categoryName: offer.categoryName,
        }));
    }
    buildServices(params) {
        const block = params.context.services;
        if (!block || block.type !== "SERVICES")
            return [];
        return (block.services || []).map((service) => ({
            title: service.name,
            description: service.description,
            price: service.price,
            duration: service.duration,
        }));
    }
    buildQuestions(params, productGroups, faqSections) {
        const questions = [];
        const hasGreeting = params.intents.some((i) => (0, intent_types_1.isGreetingIntent)(i.intent));
        const isOnlySupport = params.intents.every((i) => (0, intent_types_1.isSupportIntent)(i.intent));
        if (productGroups.length === 1 && productGroups[0].items.length > 5) {
            questions.push("Preferisci iniziare da qualcosa di particolare?");
        }
        if (faqSections.length === 0 && productGroups.length === 0 && !isOnlySupport && !hasGreeting) {
            questions.push("Hai bisogno di consigli o cerchi qualcosa in particolare?");
        }
        return questions.slice(0, 2);
    }
    buildRegistrationPrompt() {
        return [
            "Per vedere i prezzi e fare ordini, registrati in 30 secondi! 📝",
            "[link registrazione]",
            "",
            "🔒 I tuoi dati sono al sicuro:",
            "• NON vengono condivisi con terzi",
            "• NON vengono inviati a modelli AI",
            "• Gestiti solo da noi per il tuo servizio",
            "",
            "Intanto posso rispondere a qualsiasi domanda! 😊",
        ].join("\n");
    }
}
exports.ContentMixerService = ContentMixerService;
//# sourceMappingURL=content-mixer.service.js.map