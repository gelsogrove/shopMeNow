/**
 * demoRobot Routes — flow-builder editor API
 *
 * Middleware Stack (CLAUDE.md security pattern):
 * 1. authMiddleware              - Verify JWT token
 * 2. sessionValidationMiddleware - Validate x-session-id
 * 3. validateWorkspaceId         - Verify x-workspace-id matches :workspaceId param
 */

import { Router } from 'express'
import multer from 'multer'
import { FlowBuilderController } from '../controllers/flow-builder.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import { sessionValidationMiddleware } from '../middlewares/session-validation.middleware'
import { workspaceValidationMiddleware } from '../middlewares/workspace-validation.middleware'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
})

export function createFlowBuilderRoutes(): Router {
  const router = Router()
  const controller = new FlowBuilderController()

  const middlewares = [authMiddleware, sessionValidationMiddleware, workspaceValidationMiddleware]

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/demorobot/robot-models:
   *   get:
   *     summary: List Categories for a workspace
   *     tags: [DemoRobot]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of robot models
   *   post:
   *     summary: Create a Category
   *     tags: [DemoRobot]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name, slug]
   *             properties:
   *               name:
   *                 type: string
   *               slug:
   *                 type: string
   *               description:
   *                 type: string
   *     responses:
   *       201:
   *         description: Category created
   */
  router.get('/workspaces/:workspaceId/demorobot/robot-models', ...middlewares, controller.listCategories.bind(controller))
  router.post('/workspaces/:workspaceId/demorobot/robot-models', ...middlewares, controller.createCategory.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/demorobot/robot-models/{robotModelId}:
   *   patch:
   *     summary: Update a Category
   *     tags: [DemoRobot]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: robotModelId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Category updated
   *       404:
   *         description: Not found
   *   delete:
   *     summary: Delete a Category (cascades Flows/Assets)
   *     tags: [DemoRobot]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: robotModelId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       204:
   *         description: Deleted
   *       404:
   *         description: Not found
   */
  router.patch('/workspaces/:workspaceId/demorobot/robot-models/:robotModelId', ...middlewares, controller.updateCategory.bind(controller))
  router.delete('/workspaces/:workspaceId/demorobot/robot-models/:robotModelId', ...middlewares, controller.deleteCategory.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/demorobot/flows:
   *   get:
   *     summary: List Flows (by category, or generic=true for the workspace fallback flow)
   *     tags: [DemoRobot]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *       - in: query
   *         name: robotModelId
   *         schema:
   *           type: string
   *       - in: query
   *         name: generic
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of flows
   *   post:
   *     summary: Create a Flow
   *     tags: [DemoRobot]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [title]
   *             properties:
   *               title:
   *                 type: string
   *               robotModelId:
   *                 type: string
   *                 nullable: true
   *               description:
   *                 type: string
   *     responses:
   *       201:
   *         description: Flow created
   */
  router.get('/workspaces/:workspaceId/demorobot/flows', ...middlewares, controller.listFlows.bind(controller))
  router.post('/workspaces/:workspaceId/demorobot/flows', ...middlewares, controller.createFlow.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/demorobot/flows/{flowId}:
   *   delete:
   *     summary: Delete a Flow
   *     tags: [DemoRobot]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: flowId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       204:
   *         description: Deleted
   *       404:
   *         description: Not found
   */
  router.delete('/workspaces/:workspaceId/demorobot/flows/:flowId', ...middlewares, controller.deleteFlow.bind(controller))

  /**
   * @openapi
   * /api/workspaces/{workspaceId}/demorobot/flows/{flowId}/duplicate:
   *   post:
   *     tags: [Flow Builder]
   *     summary: Duplicate a flow with its full graph
   *     description: >
   *       Creates a copy of the flow, including all nodes, edges and attachment
   *       links. Nodes get new ids and edges are rewired onto them, so the copy
   *       is fully independent of the original. Attachments reference the same
   *       Assets rather than re-uploading files. The title comes from the request
   *       body; when omitted it defaults to "<original> (copy)".
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema: { type: string }
   *       - in: path
   *         name: flowId
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               title:
   *                 type: string
   *                 description: Title for the duplicated flow
   *     responses:
   *       201:
   *         description: The newly created flow
   *       404:
   *         description: Flow not found
   */
  router.post('/workspaces/:workspaceId/demorobot/flows/:flowId/duplicate', ...middlewares, controller.duplicateFlow.bind(controller))

  /**
   * @openapi
   * /api/workspaces/{workspaceId}/demorobot/flows/{flowId}/prompt/generate:
   *   post:
   *     tags: [Flow Builder]
   *     summary: Generate plain-language instructions from the flow graph
   *     description: >
   *       Rewrites the flow's compiled prompt as human-readable instructions via
   *       an LLM. Read-only — the caller reviews the result and saves it
   *       separately with PUT .../prompt.
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema: { type: string }
   *       - in: path
   *         name: flowId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: The generated prompt
   *       404:
   *         description: Flow not found
   *       502:
   *         description: The AI service could not produce a prompt
   */
  router.post('/workspaces/:workspaceId/demorobot/flows/:flowId/prompt/generate', ...middlewares, controller.generateFlowPrompt.bind(controller))

  /**
   * @openapi
   * /api/workspaces/{workspaceId}/demorobot/flows/{flowId}/prompt:
   *   put:
   *     tags: [Flow Builder]
   *     summary: Save the reviewed prompt for a flow
   *     description: Stores the instructions after the user reviewed/edited them. An empty string clears it.
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema: { type: string }
   *       - in: path
   *         name: flowId
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               humanPrompt: { type: string }
   *     responses:
   *       204:
   *         description: Saved
   *       400:
   *         description: humanPrompt missing or not a string
   *       404:
   *         description: Flow not found
   */
  router.put('/workspaces/:workspaceId/demorobot/flows/:flowId/prompt', ...middlewares, controller.saveFlowPrompt.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/demorobot/flows/{flowId}/graph:
   *   get:
   *     summary: Get the full node/edge graph for a Flow
   *     tags: [DemoRobot]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: flowId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Flow graph (flow, nodes, edges)
   *       404:
   *         description: Not found
   *   put:
   *     summary: Compile, validate, and atomically save the Flow graph (single-stage lifecycle — no draft/publish split)
   *     tags: [DemoRobot]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: flowId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Save result — { ok, flow } on success, { ok:false, validationReport } on failure
   *       404:
   *         description: Not found
   */
  router.get('/workspaces/:workspaceId/demorobot/flows/:flowId/graph', ...middlewares, controller.getFlowGraph.bind(controller))
  router.put('/workspaces/:workspaceId/demorobot/flows/:flowId/graph', ...middlewares, controller.saveFlowGraph.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/demorobot/robot-models/{robotModelId}/assets:
   *   get:
   *     summary: List Assets for a Category
   *     tags: [DemoRobot]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: robotModelId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of assets
   *   post:
   *     summary: Upload a file Asset (document/image/video) for a Category
   *     tags: [DemoRobot]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: robotModelId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required: [file, type, title]
   *             properties:
   *               file:
   *                 type: string
   *                 format: binary
   *               type:
   *                 type: string
   *                 enum: [document, image, video]
   *               title:
   *                 type: string
   *               summary:
   *                 type: string
   *               language:
   *                 type: string
   *     responses:
   *       201:
   *         description: Asset created
   */
  router.get('/workspaces/:workspaceId/demorobot/robot-models/:robotModelId/assets', ...middlewares, controller.listAssets.bind(controller))
  router.post(
    '/workspaces/:workspaceId/demorobot/robot-models/:robotModelId/assets',
    ...middlewares,
    upload.single('file'),
    controller.createAssetFromFile.bind(controller),
  )

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/demorobot/robot-models/{robotModelId}/assets/link:
   *   post:
   *     summary: Create a link-type Asset (no file upload) for a Category
   *     tags: [DemoRobot]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: robotModelId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [url, title]
   *             properties:
   *               url:
   *                 type: string
   *               title:
   *                 type: string
   *               summary:
   *                 type: string
   *               language:
   *                 type: string
   *     responses:
   *       201:
   *         description: Asset created
   */
  router.post(
    '/workspaces/:workspaceId/demorobot/robot-models/:robotModelId/assets/link',
    ...middlewares,
    controller.createAssetLink.bind(controller),
  )

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/demorobot/robot-models/{robotModelId}/assets/{assetId}:
   *   delete:
   *     summary: Delete an Asset
   *     tags: [DemoRobot]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: robotModelId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: assetId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       204:
   *         description: Deleted
   *       404:
   *         description: Not found
   */
  router.delete(
    '/workspaces/:workspaceId/demorobot/robot-models/:robotModelId/assets/:assetId',
    ...middlewares,
    controller.deleteAsset.bind(controller),
  )

  return router
}
