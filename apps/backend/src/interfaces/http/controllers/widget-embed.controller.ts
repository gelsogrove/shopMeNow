import { Request, Response } from "express"
import { prisma } from "@echatbot/database"
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

      const embedCode = await this.generateEmbedCodeSnippet(workspaceId)

      // Return as downloadable code or inline
      res.status(200).json({
        success: true,
        embedCode,
        workspaceId,
        message: "Copy this code into your website's HTML",
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      logger.error("Failed to generate embed code:", error)

      // Check if it's a channel type error
      if (message.includes('informational')) {
        res.status(403).json({
          error: "Widget not available for this channel",
          message: "Widget is only available for informational channels. Use WhatsApp for e-commerce.",
        })
        return
      }

      res.status(500).json({
        error: "Failed to generate embed code",
        message,
      })
    }
  }

  /**
   * Generate the complete embed code snippet
   * Returns HTML/JS code that customer can copy/paste
   */
  private async generateEmbedCodeSnippet(workspaceId: string): Promise<string> {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        name: true,
        widgetTitle: true,
        logoUrl: true,
        widgetLogoUrl: true,
        widgetLanguage: true,
        widgetPrimaryColor: true,
        widgetIcon: true,
        widgetUseChannelLogo: true,
        sellsProductsAndServices: true,
      },
    })

    // ❌ BLOCK: Widget not for e-commerce channels
    if (workspace?.sellsProductsAndServices === true) {
      throw new Error(
        'Widget is only available for informational channels. Use WhatsApp for e-commerce.'
      )
    }

    const title = workspace?.widgetTitle?.trim() || workspace?.name || "Chat with us 💬"
    const useChannelLogo = workspace?.widgetUseChannelLogo === true
    const logoUrl = useChannelLogo ? (workspace?.logoUrl?.trim() || "") : ""
    const language = workspace?.widgetLanguage || "it"
    const primaryColor = workspace?.widgetPrimaryColor || "#22c55e"
    const icon = (workspace?.widgetIcon || "chat").trim()

    const widgetUrl = process.env.WIDGET_URL || `${process.env.API_URL}/widget.js`
    const apiUrl = process.env.API_URL || "http://localhost:3001/api/v1"
    
    // Add cache-busting version to widget.js
    const widgetVersion = Date.now()
    const widgetUrlWithVersion = `${widgetUrl}?v=${widgetVersion}`

    return `<!-- eChatbot Widget - Embed this code on your website -->
<script>
  (function() {
    // Widget Configuration
    window.eChatbotConfig = {
      workspaceId: "${workspaceId}",
      apiUrl: "${apiUrl}",
      title: "${title.replace(/"/g, '\\"')}",
      logoUrl: "${logoUrl.replace(/"/g, '\\"')}",
      useChannelLogo: ${useChannelLogo},
      language: "${language}",
      primaryColor: "${primaryColor}",
      icon: "${icon.replace(/"/g, '\\"')}",
      position: "bottom-right",
      theme: "light"
    };

    // Load widget script
    const script = document.createElement("script");
    script.src = "${widgetUrlWithVersion}";
    script.async = true;
    script.onload = function() {
      if (window.eChatbotWidget) {
        window.eChatbotWidget.init(window.eChatbotConfig);
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

      const embedCode = await this.generateEmbedCodeSnippet(workspaceId)

      // Return as text/plain for easy copying
      res
        .set("Content-Type", "text/plain")
        .set(
          "Content-Disposition",
          `attachment; filename="echatbot-widget-${workspaceId}.js"`
        )
        .send(embedCode)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      logger.error("Failed to generate plain text embed code:", error)

      // Check if it's a channel type error
      if (message.includes('informational')) {
        res.status(403).json({
          error: "Widget not available for this channel",
          message: "Widget is only available for informational channels. Use WhatsApp for e-commerce.",
        })
        return
      }

      res.status(500).json({
        error: "Failed to generate embed code",
        message,
      })
    }
  }
}
