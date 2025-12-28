"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NaturalMixerService = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
const logger_1 = __importDefault(require("../../utils/logger"));
/**
 * LLM-based natural mixer/formatter.
 * Takes the structured blocks and asks the model to produce one
 * natural reply, avoiding menu-like prompts when not needed.
 */
class NaturalMixerService {
    constructor(model = "openai/gpt-4o-mini") {
        this.model = model;
    }
    build(params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            const systemPrompt = this.buildSystemPrompt(params);
            const userContent = this.buildUserContent(params);
            try {
                const res = yield (0, node_fetch_1.default)("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        model: this.model,
                        temperature: 0.9,
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: userContent },
                        ],
                    }),
                });
                if (!res.ok) {
                    logger_1.default.warn("[NaturalMixer] LLM call failed", { status: res.status });
                    return this.fallback(params);
                }
                const data = (yield res.json());
                const content = (_d = (_c = (_b = (_a = data === null || data === void 0 ? void 0 : data.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) === null || _d === void 0 ? void 0 : _d.trim();
                if (!content) {
                    return this.fallback(params);
                }
                return content;
            }
            catch (error) {
                logger_1.default.error("[NaturalMixer] error", { error });
                return this.fallback(params);
            }
        });
    }
    buildSystemPrompt(params) {
        const { context } = params;
        return [
            "Sei un assistente per e-commerce, tono naturale e conciso.",
            "Regole:",
            "- Saluta solo una volta per sessione. Se c'è un intro, usalo, altrimenti salta il saluto se non serve.",
            "- Se c'è UNA sola categoria/gruppo: NON chiedere quale gruppo, NON usare liste numerate. Mostra subito i prodotti (max 5) in bullet con un breve framing naturale.",
            "- Se ci sono più gruppi: presenta i titoli dei gruppi con 2-3 prodotti ciascuno, tono conversazionale, evita comunque liste numerate rigide.",
            "- Usa il tono del workspace se fornito; niente template rigidi.",
            "- Non inventare prodotti, prezzi, SKU o offerte: usa solo quelli nel payload.",
            "- Se l'utente è guest (prezzi mancanti), non inserire prezzi.",
            "- Se presente registrationPrompt, includila in chiusura naturale.",
            "- Se ci sono FAQ rilevanti, inseriscile in forma breve, non come blocchi separati.",
            "- Se ci sono servizi, descrivili con tono commerciale sintetico, evitando di fermarti al primo.",
            "- Fai massimo 1-2 domande di chiarimento, solo se utili.",
            "- Rispetta la lingua del cliente se fornita, altrimenti italiano.",
        ].join("\n");
    }
    buildUserContent(params) {
        var _a, _b, _c;
        const { output, context, customerLanguage } = params;
        const lang = customerLanguage || "it";
        const blocks = {
            intro: output.intro,
            productGroups: output.productGroups,
            faqSections: output.faqSections,
            offerSections: output.offerSections,
            serviceSections: output.serviceSections,
            questions: output.questions,
            registrationPrompt: output.registrationPrompt,
            preferences: context.preferences,
            toneOfVoice: context.workspace.toneOfVoice,
            conversationSummary: context.conversation.summary,
            recentMessages: (_a = context.conversation.recentMessages) === null || _a === void 0 ? void 0 : _a.slice(-4),
            customerName: (_b = context.customerProfile) === null || _b === void 0 ? void 0 : _b.name,
            isRegistered: (_c = params.isRegistered) !== null && _c !== void 0 ? _c : true,
            language: lang,
        };
        return JSON.stringify(blocks, null, 2);
    }
    fallback(params) {
        var _a, _b, _c;
        const { output } = params;
        const parts = [];
        if (output.intro)
            parts.push(output.intro);
        if ((_a = output.productGroups) === null || _a === void 0 ? void 0 : _a.length) {
            output.productGroups.forEach((g) => {
                parts.push(`\n${g.title}:`);
                g.items.slice(0, 5).forEach((p) => {
                    const price = p.price ? ` (${p.price}€)` : "";
                    parts.push(`• ${p.name}${price}`);
                });
            });
        }
        if ((_b = output.faqSections) === null || _b === void 0 ? void 0 : _b.length) {
            parts.push("\nFAQ:");
            output.faqSections.slice(0, 2).forEach((f) => {
                parts.push(`• ${f.question}: ${f.answer}`);
            });
        }
        if (output.registrationPrompt) {
            parts.push("\n" + output.registrationPrompt);
        }
        if ((_c = output.questions) === null || _c === void 0 ? void 0 : _c.length) {
            parts.push(output.questions[0]);
        }
        return parts.filter(Boolean).join("\n");
    }
}
exports.NaturalMixerService = NaturalMixerService;
//# sourceMappingURL=natural-mixer.service.js.map