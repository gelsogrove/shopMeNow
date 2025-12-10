/**
 * PromptBuilderService - Dynamic Prompt Generation
 *
 * 🎯 THE HEART OF THE PROJECT
 *
 * This service generates prompts DYNAMICALLY at runtime based on:
 * - Workspace configuration (sellsProductsAndServices, hasHumanSupport, etc.)
 * - Customer context (name, language, discount, etc.)
 * - Dynamic data (products, offers, FAQs, etc.)
 *
 * Architecture:
 * - TemplateLoaderService: Loads base templates from filesystem
 * - VariableResolverService: Collects all 35+ variables from DB
 * - TemplateEngineService: Replaces {{var}} and handles {{#if}}
 *
 * Single Responsibility: Each LLM gets ONLY its relevant prompt.
 * - Router: decides which agent to call
 * - ProductSearch: searches products, manages cart
 * - OrderTracking: manages existing orders
 * - CustomerSupport: handles complaints, escalation
 * - ProfileManagement: manages profile, notifications
 * - Security: validates message safety
 * - Translation: translates + formats final response
 * - Summary: summarizes conversation for operator email
 *
 * @critical NEVER mix responsibilities between agents
 * @critical ALWAYS generate at runtime for fresh data
 */

import { PrismaClient, AgentType } from "@echatbot/database"
import logger from "../../../utils/logger"
import { TemplateLoaderService } from "./template-loader.service"
import { VariableResolverService } from "./variable-resolver.service"
import { TemplateEngineService } from "./template-engine.service"

export interface PromptBuildContext {
  workspaceId: string
  customerId?: string
  conversationId?: string
}

export interface BuiltPrompt {
  content: string
  agentType: AgentType
  variables: Record<string, any>
  generatedAt: Date
}

export class PromptBuilderService {
  private prisma: PrismaClient
  private templateLoader: TemplateLoaderService
  private variableResolver: VariableResolverService
  private templateEngine: TemplateEngineService

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.templateLoader = new TemplateLoaderService()
    this.variableResolver = new VariableResolverService(prisma)
    this.templateEngine = new TemplateEngineService()

    logger.info("✅ PromptBuilderService initialized")
  }

  /**
   * Build prompt for a specific agent type
   *
   * @param agentType - Which agent needs the prompt
   * @param context - Workspace and customer context
   * @returns Generated prompt ready for LLM
   */
  async build(
    agentType: AgentType,
    context: PromptBuildContext
  ): Promise<BuiltPrompt> {
    const startTime = Date.now()

    logger.info(`🔨 Building prompt for ${agentType}`, {
      workspaceId: context.workspaceId,
      customerId: context.customerId,
    })

    try {
      // 0. Get workspace config to determine template folder
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: context.workspaceId },
        select: { sellsProductsAndServices: true },
      })
      const hasEcommerce = workspace?.sellsProductsAndServices ?? true

      // 1. Load base template for this agent (from correct folder based on workspace type)
      const template = await this.templateLoader.load(agentType, hasEcommerce)

      // 2. Resolve all variables needed for this agent
      const variables = await this.variableResolver.resolve(
        agentType,
        context.workspaceId,
        context.customerId
      )

      // 3. Apply template engine (replace variables, handle conditionals)
      const content = this.templateEngine.process(template, variables)

      const executionTime = Date.now() - startTime

      logger.info(`✅ Prompt built for ${agentType} in ${executionTime}ms`, {
        templateLength: template.length,
        contentLength: content.length,
        variablesCount: Object.keys(variables).length,
      })

      return {
        content,
        agentType,
        variables,
        generatedAt: new Date(),
      }
    } catch (error) {
      logger.error(`❌ Failed to build prompt for ${agentType}:`, error)
      throw error
    }
  }

  /**
   * Build Router prompt (most common use case)
   */
  async buildRouterPrompt(context: PromptBuildContext): Promise<string> {
    const result = await this.build("ROUTER" as AgentType, context)
    return result.content
  }

  /**
   * Build prompt for specialist agent
   */
  async buildAgentPrompt(
    agentType: AgentType,
    context: PromptBuildContext
  ): Promise<string> {
    const result = await this.build(agentType, context)
    return result.content
  }

  /**
   * Check if an agent should be available based on workspace config
   */
  async isAgentAvailable(
    agentType: AgentType,
    workspaceId: string
  ): Promise<boolean> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        sellsProductsAndServices: true,
        hasHumanSupport: true,
        hasSalesAgents: true,
      },
    })

    if (!workspace) return false

    // Agents that require e-commerce
    const ecommerceAgents: AgentType[] = [
      "PRODUCT_SEARCH" as AgentType,
      "ORDER_TRACKING" as AgentType,
    ]

    // Agents that require human support
    const humanSupportAgents: AgentType[] = [
      "SUMMARY_AGENT" as AgentType,
    ]

    if (ecommerceAgents.includes(agentType)) {
      return workspace.sellsProductsAndServices === true
    }

    if (humanSupportAgents.includes(agentType)) {
      return workspace.hasHumanSupport === true
    }

    // Always available: ROUTER, CUSTOMER_SUPPORT, PROFILE_MANAGEMENT, SECURITY, TRANSLATION
    return true
  }

  /**
   * Get list of available agents for a workspace
   */
  async getAvailableAgents(workspaceId: string): Promise<AgentType[]> {
    const allAgents: AgentType[] = [
      "ROUTER" as AgentType,
      "PRODUCT_SEARCH" as AgentType,
      "ORDER_TRACKING" as AgentType,
      "CUSTOMER_SUPPORT" as AgentType,
      "PROFILE_MANAGEMENT" as AgentType,
      "SECURITY" as AgentType,
      "TRANSLATION" as AgentType,
      "SUMMARY_AGENT" as AgentType,
    ]

    const available: AgentType[] = []

    for (const agent of allAgents) {
      if (await this.isAgentAvailable(agent, workspaceId)) {
        available.push(agent)
      }
    }

    return available
  }
}
