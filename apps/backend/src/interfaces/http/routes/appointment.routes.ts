/**
 * Appointment Routes
 * 
 * Express routes for appointment booking system.
 * All routes protected by authMiddleware + workspaceValidationMiddleware.
 */

import { Router } from 'express';
import { PrismaClient } from '@echatbot/database';
import { AppointmentController } from '../controllers/appointment.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { workspaceValidationMiddleware } from '../middlewares/workspace-validation.middleware';

const router = Router();
const prisma = new PrismaClient();
const appointmentController = new AppointmentController(prisma);

// ============================================
// APPOINTMENT TYPES
// ============================================

/**
 * @swagger
 * /api/workspaces/{workspaceId}/appointment-types:
 *   get:
 *     summary: Get all appointment types
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: List of appointment types
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/workspaces/:workspaceId/appointment-types',
  authMiddleware,
  workspaceValidationMiddleware,
  appointmentController.getAppointmentTypes.bind(appointmentController)
);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/appointment-types/{id}:
 *   get:
 *     summary: Get appointment type by ID
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Appointment type details
 *       404:
 *         description: Not found
 */
router.get(
  '/workspaces/:workspaceId/appointment-types/:id',
  authMiddleware,
  workspaceValidationMiddleware,
  appointmentController.getAppointmentType.bind(appointmentController)
);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/appointment-types:
 *   post:
 *     summary: Create new appointment type
 *     tags: [Appointments]
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
 *             required:
 *               - name
 *               - duration
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Consulenza Legale"
 *               description:
 *                 type: string
 *                 example: "Consulenza legale con avvocato (60 minuti)"
 *               duration:
 *                 type: integer
 *                 minimum: 15
 *                 maximum: 480
 *                 example: 60
 *               bufferTime:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 120
 *                 example: 15
 *               price:
 *                 type: number
 *                 format: float
 *                 example: 150.00
 *               color:
 *                 type: string
 *                 example: "#3b82f6"
 *     responses:
 *       201:
 *         description: Appointment type created
 *       400:
 *         description: Validation error
 */
router.post(
  '/workspaces/:workspaceId/appointment-types',
  authMiddleware,
  workspaceValidationMiddleware,
  appointmentController.createAppointmentType.bind(appointmentController)
);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/appointment-types/{id}:
 *   patch:
 *     summary: Update appointment type
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               duration:
 *                 type: integer
 *               bufferTime:
 *                 type: integer
 *               price:
 *                 type: number
 *               color:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Appointment type updated
 *       404:
 *         description: Not found
 */
router.patch(
  '/workspaces/:workspaceId/appointment-types/:id',
  authMiddleware,
  workspaceValidationMiddleware,
  appointmentController.updateAppointmentType.bind(appointmentController)
);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/appointment-types/{id}:
 *   delete:
 *     summary: Delete (deactivate) appointment type
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Appointment type deleted
 *       400:
 *         description: Cannot delete (pending appointments exist)
 *       404:
 *         description: Not found
 */
router.delete(
  '/workspaces/:workspaceId/appointment-types/:id',
  authMiddleware,
  workspaceValidationMiddleware,
  appointmentController.deleteAppointmentType.bind(appointmentController)
);

// ============================================
// BUSINESS HOURS
// ============================================

/**
 * @swagger
 * /api/workspaces/{workspaceId}/business-hours:
 *   get:
 *     summary: Get business hours
 *     tags: [Appointments]
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
 *         description: Business hours by day
 */
router.get(
  '/workspaces/:workspaceId/business-hours',
  authMiddleware,
  workspaceValidationMiddleware,
  appointmentController.getBusinessHours.bind(appointmentController)
);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/business-hours:
 *   put:
 *     summary: Update business hours (bulk upsert)
 *     tags: [Appointments]
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
 *             required:
 *               - hours
 *             properties:
 *               hours:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - dayOfWeek
 *                     - startTime
 *                     - endTime
 *                   properties:
 *                     dayOfWeek:
 *                       type: integer
 *                       minimum: 0
 *                       maximum: 6
 *                       description: "0=Sunday, 1=Monday, ..., 6=Saturday"
 *                     startTime:
 *                       type: string
 *                       example: "09:00"
 *                     endTime:
 *                       type: string
 *                       example: "17:00"
 *                     isActive:
 *                       type: boolean
 *                       default: true
 *     responses:
 *       200:
 *         description: Business hours updated
 *       400:
 *         description: Validation error
 */
router.put(
  '/workspaces/:workspaceId/business-hours',
  authMiddleware,
  workspaceValidationMiddleware,
  appointmentController.updateBusinessHours.bind(appointmentController)
);

// ============================================
// BLACKOUT PERIODS
// ============================================

/**
 * @swagger
 * /api/workspaces/{workspaceId}/blackout-periods:
 *   get:
 *     summary: Get blackout periods
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: includeExpired
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: List of blackout periods
 */
router.get(
  '/workspaces/:workspaceId/blackout-periods',
  authMiddleware,
  workspaceValidationMiddleware,
  appointmentController.getBlackoutPeriods.bind(appointmentController)
);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/blackout-periods:
 *   post:
 *     summary: Create new blackout period
 *     tags: [Appointments]
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
 *             required:
 *               - startDate
 *               - endDate
 *             properties:
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-08-15T00:00:00Z"
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-08-31T23:59:59Z"
 *               reason:
 *                 type: string
 *                 example: "Vacanze estive 2026"
 *     responses:
 *       201:
 *         description: Blackout period created
 *       400:
 *         description: Validation error
 */
router.post(
  '/workspaces/:workspaceId/blackout-periods',
  authMiddleware,
  workspaceValidationMiddleware,
  appointmentController.createBlackoutPeriod.bind(appointmentController)
);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/blackout-periods/{id}:
 *   patch:
 *     summary: Update blackout period
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Blackout period updated
 *       404:
 *         description: Not found
 */
router.patch(
  '/workspaces/:workspaceId/blackout-periods/:id',
  authMiddleware,
  workspaceValidationMiddleware,
  appointmentController.updateBlackoutPeriod.bind(appointmentController)
);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/blackout-periods/{id}:
 *   delete:
 *     summary: Delete blackout period
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Blackout period deleted
 *       404:
 *         description: Not found
 */
router.delete(
  '/workspaces/:workspaceId/blackout-periods/:id',
  authMiddleware,
  workspaceValidationMiddleware,
  appointmentController.deleteBlackoutPeriod.bind(appointmentController)
);

// ============================================
// AVAILABLE SLOTS
// ============================================

/**
 * @swagger
 * /api/workspaces/{workspaceId}/appointments/slots:
 *   get:
 *     summary: Get available booking slots
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: appointmentTypeId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Available time slots
 *       400:
 *         description: Validation error
 */
router.get(
  '/workspaces/:workspaceId/appointments/slots',
  authMiddleware,
  workspaceValidationMiddleware,
  appointmentController.getAvailableSlots.bind(appointmentController)
);

// ============================================
// CONFIRMED APPOINTMENTS
// ============================================

/**
 * @swagger
 * /api/workspaces/{workspaceId}/appointments:
 *   get:
 *     summary: List appointments (admin)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [confirmed, cancelled, completed, no_show]
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: List of appointments
 */
router.get(
  '/workspaces/:workspaceId/appointments',
  authMiddleware,
  workspaceValidationMiddleware,
  appointmentController.getAppointments.bind(appointmentController)
);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/appointments:
 *   post:
 *     summary: Create confirmed appointment (admin)
 *     tags: [Appointments]
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
 *             required:
 *               - customerId
 *               - appointmentTypeId
 *               - startTime
 *             properties:
 *               customerId:
 *                 type: string
 *               appointmentTypeId:
 *                 type: string
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               customerNotes:
 *                 type: string
 *               bookedVia:
 *                 type: string
 *                 enum: [whatsapp, widget, admin]
 *     responses:
 *       201:
 *         description: Appointment created
 *       409:
 *         description: Slot no longer available
 */
router.post(
  '/workspaces/:workspaceId/appointments',
  authMiddleware,
  workspaceValidationMiddleware,
  appointmentController.createAppointment.bind(appointmentController)
);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/appointments/{id}/cancel:
 *   patch:
 *     summary: Cancel an appointment
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *               cancelledBy:
 *                 type: string
 *                 enum: [admin, customer, system]
 *     responses:
 *       200:
 *         description: Appointment cancelled
 *       404:
 *         description: Not found
 *       409:
 *         description: Already cancelled
 */
router.patch(
  '/workspaces/:workspaceId/appointments/:id/cancel',
  authMiddleware,
  workspaceValidationMiddleware,
  appointmentController.cancelAppointment.bind(appointmentController)
);

export default router;
