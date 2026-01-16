import { Router } from "express"
import { prisma } from "@echatbot/database"
import { authMiddleware } from "../middlewares/auth.middleware"
import logger from "../utils/logger"

const router = Router()

// TEMPORARY: Reset deletedAt for a workspace (safety: auth required).
router.post("/temp-fix-workspace/:workspaceId", authMiddleware, async (req, res) => {
  const { workspaceId } = req.params

  try {
    const workspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: { deletedAt: null },
      select: { id: true, deletedAt: true },
    })

    res.json({
      success: true,
      workspaceId: workspace.id,
      deletedAt: workspace.deletedAt,
    })
  } catch (error) {
    logger.error("TEMP fix workspace failed:", error)
    res.status(500).json({
      success: false,
      error: "Failed to reset workspace deletedAt",
    })
  }
})

export default router
