import { Router } from 'express';
import logger from '../../../utils/logger';
import { OrderController } from '../controllers/order.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { workspaceValidationMiddleware } from '../middlewares/workspace-validation.middleware';

export function createOrderRouter(): Router {
  const router = Router({ mergeParams: true });  // Enable mergeParams to inherit workspaceId
  const orderController = new OrderController();

  // Apply auth middleware to all routes
  router.use(authMiddleware);
  
  // All routes require workspace validation
  router.use(workspaceValidationMiddleware);

  // Log route registration
  logger.info('Setting up order routes');

  // GET /orders - Get all orders with filters and pagination
  router.get('/', orderController.getAllOrders);

  // GET /orders/analytics - Get order analytics
  router.get('/analytics', orderController.getOrderAnalytics);

  // GET /orders/date-range - Get orders by date range
  router.get('/date-range', orderController.getOrdersByDateRange);

  // GET /orders/:id - Get order by ID
  router.get('/:id', orderController.getOrderById);

  // GET /orders/code/:orderCode - Get order by order code
  router.get('/code/:orderCode', orderController.getOrderByCode);

  // GET /orders/customer/:customerId - Get orders by customer ID
  router.get('/customer/:customerId', orderController.getOrdersByCustomer);

  // POST /orders - Create new order
  router.post('/', orderController.createOrder);

  // PUT /orders/:id - Update order
  router.put('/:id', orderController.updateOrder);

  // DELETE /orders/:id - Delete order
  router.delete('/:id', orderController.deleteOrder);

  // PATCH /orders/:id/status - Update order status
  router.patch('/:id/status', orderController.updateOrderStatus);

  // Payment status is now handled by PaymentDetails table

  logger.info('Order routes configured');

  return router;
}

export default createOrderRouter;