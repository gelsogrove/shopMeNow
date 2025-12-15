import { PageLayout } from "@/components/layout/PageLayout"
import { PageHeader } from "@/components/shared/PageHeader"
import MarkdownEditor from "@/components/ui/markdown-editor"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useWorkspace } from "@/hooks/use-workspace"
import { logger } from "@/lib/logger"
import { Agent, getAgent, updateAgent } from "@/services/agentApi"
import { Bot, HelpCircle, Loader2, Save } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "../lib/toast"

export function AgentPage() {
  const { workspace } = useWorkspace()
  const navigate = useNavigate()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [tempValue, setTempValue] = useState(0.7)
  const [modelValue, setModelValue] = useState("openai/gpt-4.1-mini")
  const [maxTokensValue, setMaxTokensValue] = useState(1000)
  const [error, setError] = useState<string | null>(null)

  // Redirect to workspace selection if user has no workspace
  useEffect(() => {
    if (!workspace) {
      logger.info(
        "No workspace found in AgentPage, redirecting to workspace selection"
      )
      navigate("/clients")
    }
  }, [workspace, navigate])

  // Debug workspace changes
  useEffect(() => {
    logger.info("=== WORKSPACE CHANGE DEBUG ===")
    logger.info("Workspace:", workspace)
    logger.info("Workspace ID:", workspace?.id)
    logger.info("Workspace name:", workspace?.name)
    logger.info("Workspace isActive:", workspace?.isActive)

    // Check localStorage
    const sessionWorkspace = localStorage.getItem("currentWorkspace")
    logger.info("LocalStorage workspace:", sessionWorkspace)
    if (sessionWorkspace) {
      try {
        const parsedWorkspace = JSON.parse(sessionWorkspace)
        logger.info("Parsed localStorage workspace:", parsedWorkspace)
      } catch (e) {
        logger.error("Error parsing localStorage workspace:", e)
      }
    }
  }, [workspace])

  // Debug agent changes
  useEffect(() => {
    logger.info("=== AGENT CHANGE DEBUG ===")
    logger.info("Agent:", agent)
    logger.info("Agent ID:", agent?.id)
    logger.info("Agent name:", agent?.name)
    logger.info("Agent workspaceId:", agent?.workspaceId)
  }, [agent])

  // Load the agent when workspace is available
  useEffect(() => {
    const loadData = async () => {
      if (!workspace?.id) return

      try {
        setIsLoading(true)
        setError(null)
        logger.info("=== AGENT PAGE LOAD DEBUG ===")
        logger.info("Loading agent for workspace:", workspace.id)
        logger.info("Workspace object:", workspace)

        const agentData = await getAgent(workspace.id)
        logger.info("=== AGENT DATA RECEIVED ===")
        logger.info("Agent data loaded:", agentData)
        if (!agentData) {
          setAgent(null)
          setIsLoading(false)
          return
        }
        logger.info("Agent ID:", agentData?.id)
        logger.info("Agent name:", agentData?.name)
        logger.info("Agent content length:", agentData?.content?.length)
        logger.info("Agent temperature:", agentData?.temperature)
        logger.info("Agent model:", agentData?.model)
        logger.info("Agent max_tokens:", agentData?.max_tokens)

        setAgent(agentData)

        // Set form values from agent data
        setTempValue(agentData.temperature || 0.3)
        setModelValue(agentData.model || "openai/gpt-4.1-mini")
        setMaxTokensValue(agentData.max_tokens || 1000)

        logger.info("=== FORM VALUES SET ===")
        logger.info("Temperature:", agentData.temperature || 0.3)
        logger.info("Model:", agentData.model || "openai/gpt-4.1-mini")
        logger.info("Max tokens:", agentData.max_tokens || 1000)
      } catch (error) {
        logger.error("=== AGENT LOAD ERROR ===", error)
        toast.error("Failed to load agent", { duration: 1000 })
      } finally {
        setIsLoading(false)
      }
    }

    if (workspace?.id) {
      loadData()
    }
  }, [workspace?.id])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    logger.info("=== HANDLE SUBMIT DEBUG ===")
    logger.info("Agent:", agent)
    logger.info("Agent ID:", agent?.id)
    logger.info("Agent name:", agent?.name)
    logger.info("Workspace:", workspace)
    logger.info("Workspace ID:", workspace?.id)
    logger.info("Workspace name:", workspace?.name)

    if (!agent || !workspace) {
      logger.error("=== MISSING DATA ERROR ===")
      logger.error("Agent is null:", !agent)
      logger.error("Workspace is null:", !workspace)
      toast.error("Missing agent or workspace data", { duration: 1000 })
      return
    }

    // Get values from state instead of FormData
    const content = agent.content || ""
    const model = modelValue

    logger.info("=== FORM DATA ===")
    logger.info("Content length:", content?.length)
    logger.info("Model:", model)
    logger.info("Temperature:", tempValue)
    logger.info("Max tokens:", maxTokensValue)

    // Validate required fields
    if (!content.trim()) {
      toast.error("Instructions are required", { duration: 1000 })
      return
    }

    try {
      setIsSaving(true)
      logger.info("=== UPDATING AGENT ===")
      logger.info("Updating agent with data:", {
        id: agent.id,
        workspaceId: workspace.id,
        name: agent.name,
        content,
        temperature: tempValue,
        model,
        max_tokens: maxTokensValue,
      })

      const updatedAgent = await updateAgent(workspace.id, agent.id, {
        name: agent.name, // Keep the existing name
        content,
        temperature: tempValue,
        model: model || "openai/gpt-4.1-mini",
        max_tokens: maxTokensValue,
      })

      logger.info("=== UPDATE SUCCESS ===")
      logger.info("Agent updated successfully:", updatedAgent)
      setAgent(updatedAgent)
      toast.success("Agent updated successfully", { duration: 1000 })
    } catch (error) {
      logger.error("=== UPDATE ERROR ===", error)
      toast.error("Failed to update agent. Please try again.", {
        duration: 1000,
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <PageLayout>
      <div className="flex-1 space-y-2 p-1 pt-1 md:p-2">
        <PageHeader
          title={
            <div className="flex items-center gap-2">
              <Bot className="h-6 w-6 text-green-600" />
              <span className="text-green-600">Agent Configuration</span>
            </div>
          }
          description="Configure your AI agent's behavior and instructions"
        />

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex justify-center items-center h-64">
            <p className="text-red-500">{error}</p>
          </div>
        ) : !workspace?.id ? (
          <div className="flex justify-center items-center h-64">
            <p className="text-red-500">
              No workspace selected. Please select a workspace first.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {!agent ? (
              <div className="flex justify-center items-center h-64">
                <p className="text-gray-500">
                  No agent found for this workspace.
                </p>
              </div>
            ) : (
              /* Agent Configuration Section */
              <div className="bg-background rounded-lg border p-4 shadow-sm">
                <form
                  id="editAgentForm"
                  onSubmit={handleSubmit}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label
                          htmlFor="temperature"
                          className="text-sm font-medium leading-none flex items-center"
                        >
                          Temperature:{" "}
                          <span className="font-bold ml-1">{tempValue}</span>
                          <TooltipProvider delayDuration={0}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-4 w-4 ml-1 text-muted-foreground cursor-pointer" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs p-4 bg-white shadow-lg rounded-lg border z-50">
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-sm">
                                    Temperature (0-2)
                                  </h4>
                                  <p>
                                    Controls randomness in the AI's responses:
                                  </p>
                                  <ul className="list-disc pl-5 space-y-1">
                                    <li>
                                      <span className="font-medium">
                                        Low (0-0.5):
                                      </span>{" "}
                                      More focused, deterministic, and
                                      consistent responses
                                    </li>
                                    <li>
                                      <span className="font-medium">
                                        Medium (0.5-1):
                                      </span>{" "}
                                      Balanced creativity and coherence
                                    </li>
                                    <li>
                                      <span className="font-medium">
                                        High (1-2):
                                      </span>{" "}
                                      More creative, diverse, and unpredictable
                                      outputs
                                    </li>
                                  </ul>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </label>
                      </div>
                      <div>
                        <input
                          type="range"
                          id="temperature"
                          name="temperature"
                          min="0"
                          max="2"
                          step="0.1"
                          value={tempValue}
                          onChange={(e) => setTempValue(Number(e.target.value))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor="model"
                        className="text-sm font-medium leading-none flex items-center"
                      >
                        Model:{" "}
                        <span className="font-bold ml-1">{modelValue}</span>
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-4 w-4 ml-1 text-muted-foreground cursor-pointer" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs p-4 bg-white shadow-lg rounded-lg border z-50">
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm">
                                  AI Model Selection
                                </h4>
                                <p>Choose the AI model for your agent:</p>
                                <ul className="list-disc pl-5 space-y-1">
                                  <li>
                                    <span className="font-medium">
                                      🌍 Cloud Models:
                                    </span>{" "}
                                    Use OpenRouter API (requires API key, costs
                                    apply)
                                  </li>
                                </ul>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </label>
                      <select
                        id="model"
                        name="model"
                        value={modelValue}
                        onChange={(e) => setModelValue(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                      >
                        <option value="anthropic/claude-opus-4.1">
                          Claude Opus 4.1 (Premium)
                        </option>
                        <option value="openai/gpt-4.1">
                          GPT-4.1 (High-end)
                        </option>
                        <option value="google/gemini-2.5-pro">
                          Gemini 2.5 Pro
                        </option>

                        <option value="google/gemini-2.0-flash-001">
                          google/gemini-2.0-flash-001 (Best quality and fantasy)
                        </option>

                        <option value="openai/gpt-4">openai/gpt-4</option>
                        <option value="anthropic/claude-3.5-haiku">
                          anthropic/claude-3.5-haiku
                        </option>
                        <option value="x-ai/grok-4">x-ai/grok-4</option>
                        <option value="openai/gpt-4-turbo">
                          openai/gpt-4-turbo
                        </option>
                        <option value="openai/gpt-4o-mini">
                          openai/gpt-4o-mini
                        </option>
                        <option value="deepseek/deepseek-r1">
                          deepseek/deepseek-r1
                        </option>
                        <option value="anthropic/claude-3.5-sonnet">
                          anthropic/claude-3.5-sonnet
                        </option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label
                          htmlFor="maxTokens"
                          className="text-sm font-medium leading-none flex items-center"
                        >
                          Max Tokens:{" "}
                          <span className="font-bold ml-1">
                            {maxTokensValue}
                          </span>
                          <TooltipProvider delayDuration={0}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-4 w-4 ml-1 text-muted-foreground cursor-pointer" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs p-4 bg-white shadow-lg rounded-lg border z-50">
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-sm">
                                    Max Tokens (100-4000)
                                  </h4>
                                  <p>Controls response length:</p>
                                  <ul className="list-disc pl-5 space-y-1">
                                    <li>
                                      <span className="font-medium">
                                        Low (100-500):
                                      </span>{" "}
                                      Short, concise responses
                                    </li>
                                    <li>
                                      <span className="font-medium">
                                        Medium (500-1500):
                                      </span>{" "}
                                      Balanced detail level
                                    </li>
                                    <li>
                                      <span className="font-medium">
                                        High (1500-4000):
                                      </span>{" "}
                                      Detailed, comprehensive responses
                                    </li>
                                  </ul>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </label>
                      </div>
                      <div>
                        <input
                          type="range"
                          id="maxTokens"
                          name="maxTokens"
                          min="100"
                          max="4000"
                          step="100"
                          value={maxTokensValue}
                          onChange={(e) =>
                            setMaxTokensValue(Number(e.target.value))
                          }
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="content"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Instructions *
                    </label>
                    <MarkdownEditor
                      value={agent.content || ""}
                      onChange={(value) =>
                        setAgent({ ...agent, content: value })
                      }
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Save Configuration
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </PageLayout>
  )
}
