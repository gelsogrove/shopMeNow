export declare class TranslationService {
    private readonly apiKey;
    private readonly baseURL;
    private readonly model;
    constructor();
    /**
     * Translate message to target language
     * @param message - Original message (in Italian)
     * @param targetLanguage - Customer's language code (it, en, es, pt)
     * @returns Translated message
     */
    translateMessage(message: string, targetLanguage: string): Promise<string>;
}
export declare const translationService: TranslationService;
//# sourceMappingURL=translation.service.d.ts.map