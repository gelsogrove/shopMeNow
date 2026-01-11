import { Request, Response } from "express"
import logger from "../../../utils/logger"

/**
 * WidgetEmbedController
 * Handles widget embed code generation for customers
 * Allows workspace admins to get embed snippets for their websites
 */
export class WidgetEmbedController {
  /**
   * Generate embed code snippet
   * GET /workspaces/:workspaceId/widget/embed-code
   * Returns HTML/JS snippet ready to paste into customer websites
   */
  async getEmbedCode(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = (req as any).workspaceId
      const user = (req as any).user

      if (!workspaceId || !user) {
        res.status(400).json({ error: "Invalid request context" })
        return
      }

      logger.info(
        `📝 Generating widget embed code for workspace: ${workspaceId}`,
        { userId: user.id }
      )

      // Generate the embed code snippet
      const embedCode = this.generateEmbedCodeSnippet(workspaceId)

      // Return as downloadable code or inline
      res.status(200).json({
        success: true,
        embedCode,
        workspaceId,
        message: "Copy this code into your website's HTML",
      })
    } catch (error) {
      logger.error("Failed to generate embed code:", error)
      res.status(500).json({
        error: "Failed to generate embed code",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * Generate the complete embed code snippet
   * Returns HTML/JS code that customer can copy/paste
   */
  private generateEmbedCodeSnippet(workspaceId: string): string {
    const widgetUrl =
      process.env.WIDGET_URL || `${process.env.API_URL}/widget.js`

    return `<!-- eChatbot Widget - Embed this code on your website -->
<script>
  (function() {
    // Widget Configuration
    const eChatbotConfig = {
      workspaceId: "${workspaceId}",
      position: "bottom-right",
      theme: "light"
    };

    // Load widget script
    const script = document.createElement("script");
    script.src = "${widgetUrl}";
    script.async = true;
    script.onload = function() {
      if (window.eChatbotWidget) {
        window.eChatbotWidget.init(eChatbotConfig);
      }
    };
    script.onerror = function() {
      console.error("Failed to load eChatbot widget");
    };

    // Append to document head
    document.head.appendChild(script);
  })();
</script>
<!-- End eChatbot Widget -->`
  }

  /**
   * Get embed code as plain text (for API-based access)
   * POST /workspaces/:workspaceId/widget/embed-code/text
   * Returns plain JavaScript code without HTML wrapper
   */
  async getEmbedCodeText(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = (req as any).workspaceId
      const user = (req as any).user

      if (!workspaceId || !user) {
        res.status(400).json({ error: "Invalid request context" })
        return
      }

      logger.info(
        `📝 Generating plain text embed code for workspace: ${workspaceId}`,
        { userId: user.id }
      )

      const embedCode = this.generateEmbedCodeSnippet(workspaceId)

      // Return as text/plain for easy copying
      res
        .set("Content-Type", "text/plain")
        .set(
          "Content-Disposition",
          `attachment; filename="echatbot-widget-${workspaceId}.js"`
        )
        .send(embedCode)
    } catch (error) {
      logger.error("Failed to generate plain text embed code:", error)
      res.status(500).json({
        error: "Failed to generate embed code",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }
}
