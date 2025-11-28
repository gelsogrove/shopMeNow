import { Router } from "express";
import { OfferController } from "../controllers/offer.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware";

/**
 * @swagger
 * components:
 *   schemas:
 *     Offer:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - discountPercent
 *         - startDate
 *         - endDate
 *         - workspaceId
 *       properties:
 *         id:
 *           type: string
 *           description: ID univoco dell'offerta
 *         name:
 *           type: string
 *           description: Nome dell'offerta
 *         description:
 *           type: string
 *           description: Descrizione dell'offerta
 *         discountPercent:
 *           type: number
 *           description: Percentuale di sconto dell'offerta
 *         startDate:
 *           type: string
 *           format: date-time
 *           description: Data di inizio validità dell'offerta
 *         endDate:
 *           type: string
 *           format: date-time
 *           description: Data di fine validità dell'offerta
 *         isActive:
 *           type: boolean
 *           description: Indica se l'offerta è attiva
 *         categoryId:
 *           type: string
 *           description: ID della categoria associata all'offerta
 *         workspaceId:
 *           type: string
 *           description: ID del workspace a cui appartiene l'offerta
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Data di creazione dell'offerta
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Data dell'ultimo aggiornamento dell'offerta
 */

export const offersRouter = (): Router => {
  const router = Router({ mergeParams: true });
  const controller = new OfferController();

  // All routes require authentication
  router.use(authMiddleware);
  
  // All routes require workspace validation
  router.use(workspaceValidationMiddleware);

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/offers:
   *   get:
   *     summary: Ottiene tutte le offerte di un workspace
   *     tags: [Offers]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID del workspace
   *     responses:
   *       200:
   *         description: Lista delle offerte
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Offer'
   */
  router.get("/", controller.getAllOffers.bind(controller));
  
  /**
   * @swagger
   * /api/workspaces/{workspaceId}/offers/active:
   *   get:
   *     summary: Ottiene le offerte attive di un workspace
   *     tags: [Offers]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID del workspace
   *       - in: query
   *         name: categoryId
   *         schema:
   *           type: string
   *         required: false
   *         description: ID della categoria per filtrare le offerte
   *     responses:
   *       200:
   *         description: Lista delle offerte attive
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Offer'
   */
  router.get("/active", controller.getActiveOffers.bind(controller));
  
  /**
   * @swagger
   * /api/workspaces/{workspaceId}/offers/{id}:
   *   get:
   *     summary: Ottiene un'offerta specifica
   *     tags: [Offers]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID del workspace
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID dell'offerta
   *     responses:
   *       200:
   *         description: Dettagli dell'offerta
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Offer'
   *       404:
   *         description: Offerta non trovata
   */
  router.get("/:id", controller.getOfferById.bind(controller));
  
  /**
   * @swagger
   * /api/workspaces/{workspaceId}/offers:
   *   post:
   *     summary: Crea una nuova offerta
   *     tags: [Offers]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID del workspace
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *               - discountPercent
   *               - startDate
   *               - endDate
   *             properties:
   *               name:
   *                 type: string
   *                 description: Nome dell'offerta
   *               description:
   *                 type: string
   *                 description: Descrizione dell'offerta
   *               discountPercent:
   *                 type: number
   *                 description: Percentuale di sconto dell'offerta
   *               startDate:
   *                 type: string
   *                 format: date-time
   *                 description: Data di inizio validità dell'offerta
   *               endDate:
   *                 type: string
   *                 format: date-time
   *                 description: Data di fine validità dell'offerta
   *               isActive:
   *                 type: boolean
   *                 description: Indica se l'offerta è attiva
   *               categoryId:
   *                 type: string
   *                 description: ID della categoria associata all'offerta
   *     responses:
   *       201:
   *         description: Offerta creata con successo
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Offer'
   */
  router.post("/", controller.createOffer.bind(controller));
  
  /**
   * @swagger
   * /api/workspaces/{workspaceId}/offers/{id}:
   *   put:
   *     summary: Aggiorna un'offerta esistente
   *     tags: [Offers]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID del workspace
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID dell'offerta
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *                 description: Nome dell'offerta
   *               description:
   *                 type: string
   *                 description: Descrizione dell'offerta
   *               discountPercent:
   *                 type: number
   *                 description: Percentuale di sconto dell'offerta
   *               startDate:
   *                 type: string
   *                 format: date-time
   *                 description: Data di inizio validità dell'offerta
   *               endDate:
   *                 type: string
   *                 format: date-time
   *                 description: Data di fine validità dell'offerta
   *               isActive:
   *                 type: boolean
   *                 description: Indica se l'offerta è attiva
   *               categoryId:
   *                 type: string
   *                 description: ID della categoria associata all'offerta
   *     responses:
   *       200:
   *         description: Offerta aggiornata con successo
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Offer'
   *       404:
   *         description: Offerta non trovata
   */
  router.put("/:id", controller.updateOffer.bind(controller));
  
  /**
   * @swagger
   * /api/workspaces/{workspaceId}/offers/{id}:
   *   delete:
   *     summary: Elimina un'offerta
   *     tags: [Offers]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID del workspace
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID dell'offerta
   *     responses:
   *       200:
   *         description: Offerta eliminata con successo
   *       404:
   *         description: Offerta non trovata
   */
  router.delete("/:id", controller.deleteOffer.bind(controller));

  return router;
}; 