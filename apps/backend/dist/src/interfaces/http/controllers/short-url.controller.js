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
exports.shortUrlController = exports.ShortUrlController = void 0;
const url_shortener_service_1 = require("../../../application/services/url-shortener.service");
const config_1 = require("../../../config");
const logger_1 = __importDefault(require("../../../utils/logger"));
/**
 * Short URL Controller
 * Handles redirection from short URLs to original URLs
 */
class ShortUrlController {
    /**
     * Redirect from short URL to original URL
     * GET /s/:shortCode
     */
    redirect(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { shortCode } = req.params;
                if (!shortCode) {
                    res.status(400).json({
                        success: false,
                        error: "Short code is required",
                    });
                    return;
                }
                // Auto-cleanup old URLs (>1 hour) on each request
                // This runs asynchronously without blocking the redirect
                url_shortener_service_1.urlShortenerService.cleanupOldUrls().catch((error) => {
                    logger_1.default.error("❌ Error in background cleanup:", error);
                });
                logger_1.default.info(`📎 Resolving short URL: /s/${shortCode}`);
                const result = yield url_shortener_service_1.urlShortenerService.resolveShortUrl(shortCode);
                if (!result.success) {
                    if (result.notFound) {
                        // Redirect to not found page instead of returning JSON
                        logger_1.default.info(`📎 Short URL not found, redirecting to 404 page`);
                        res.redirect(302, `${config_1.config.frontendUrl}/not-found`);
                    }
                    else if (result.expired) {
                        // Redirect to expired page instead of returning JSON
                        logger_1.default.info(`📎 Short URL expired, redirecting to expired page`);
                        res.redirect(302, `${config_1.config.frontendUrl}/expired`);
                    }
                    else {
                        res.status(500).json({
                            success: false,
                            error: "Failed to resolve short URL",
                        });
                    }
                    return;
                }
                // Check if URL is a PDF file
                const isPdf = result.originalUrl.toLowerCase().endsWith(".pdf");
                if (isPdf) {
                    // For PDF files, return HTML that opens in new window/tab
                    logger_1.default.info(`📎 PDF detected, opening in new window: ${result.originalUrl}`);
                    // ✅ SECURITY FIX: Use safe DOM manipulation instead of innerHTML
                    res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Opening PDF...</title>
            <script>
              // Open PDF in new window/tab
              const pdfUrl = ${JSON.stringify(result.originalUrl)};
              window.open(pdfUrl, '_blank');
              
              // Show confirmation message using safe DOM methods
              setTimeout(() => {
                // Clear body safely
                while (document.body.firstChild) {
                  document.body.removeChild(document.body.firstChild);
                }
                
                // Create elements safely (no innerHTML)
                const container = document.createElement('div');
                container.style.cssText = 'font-family: Arial; text-align: center; margin-top: 50px';
                
                const title = document.createElement('h2');
                title.textContent = 'PDF aperto in una nuova finestra';
                
                const message = document.createElement('p');
                message.textContent = 'Puoi chiudere questa scheda.';
                
                container.appendChild(title);
                container.appendChild(message);
                document.body.appendChild(container);
              }, 100);
            </script>
          </head>
          <body>
            <div style="font-family: Arial; text-align: center; margin-top: 50px;">
              <h2>Apertura PDF in corso...</h2>
              <p>Se il PDF non si apre automaticamente, <a href="${result.originalUrl}" target="_blank">clicca qui</a>.</p>
            </div>
          </body>
          </html>
        `);
                }
                else {
                    // For non-PDF URLs, do direct HTTP 302 redirect (most reliable)
                    // This ensures the redirect works on FIRST click without any SPA/JS issues
                    logger_1.default.info(`📎 HTTP 302 redirect to: ${result.originalUrl}`);
                    const targetUrl = result.originalUrl;
                    res.redirect(302, targetUrl);
                }
            }
            catch (error) {
                logger_1.default.error("❌ Error in short URL redirect:", error);
                res.status(500).json({
                    success: false,
                    error: "Internal server error",
                });
            }
        });
    }
    /**
     * Resolve short URL and return JSON instead of redirect
     * GET /s/:shortCode/resolve
     * Used by frontend SPA to get the original URL without browser redirect issues
     */
    resolve(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { shortCode } = req.params;
                if (!shortCode) {
                    res.status(400).json({
                        success: false,
                        error: "Short code is required",
                    });
                    return;
                }
                logger_1.default.info(`📎 Resolving short URL (JSON): /s/${shortCode}`);
                const result = yield url_shortener_service_1.urlShortenerService.resolveShortUrl(shortCode);
                if (!result.success) {
                    if (result.notFound) {
                        res.status(404).json({
                            success: false,
                            error: "Short URL not found",
                            notFound: true,
                        });
                    }
                    else if (result.expired) {
                        res.status(410).json({
                            success: false,
                            error: "Short URL has expired",
                            expired: true,
                        });
                    }
                    else {
                        res.status(500).json({
                            success: false,
                            error: "Failed to resolve short URL",
                        });
                    }
                    return;
                }
                // Return the original URL as JSON
                res.json({
                    success: true,
                    originalUrl: result.originalUrl,
                });
            }
            catch (error) {
                logger_1.default.error("❌ Error resolving short URL (JSON):", error);
                res.status(500).json({
                    success: false,
                    error: "Internal server error",
                });
            }
        });
    }
    /**
     * Get short URL statistics
     * GET /api/short-urls/:shortCode/stats
     */
    getStats(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { shortCode } = req.params;
                if (!shortCode) {
                    res.status(400).json({
                        success: false,
                        error: "Short code is required",
                    });
                    return;
                }
                const stats = yield url_shortener_service_1.urlShortenerService.getShortUrlStats(shortCode);
                if (!stats) {
                    res.status(404).json({
                        success: false,
                        error: "Short URL not found",
                    });
                    return;
                }
                res.json({
                    success: true,
                    stats,
                });
            }
            catch (error) {
                logger_1.default.error("❌ Error getting short URL stats:", error);
                res.status(500).json({
                    success: false,
                    error: "Internal server error",
                });
            }
        });
    }
}
exports.ShortUrlController = ShortUrlController;
exports.shortUrlController = new ShortUrlController();
//# sourceMappingURL=short-url.controller.js.map