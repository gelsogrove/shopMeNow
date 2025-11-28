import { OrderStatus } from '@prisma/client';
import { Order } from '../entities/order.entity';

export type OrderFilters = {
  search?: string;
  customerId?: string;
  status?: OrderStatus;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
};

export type PaginatedOrders = {
  orders: Order[];
  total: number;
  page: number;
  totalPages: number;
};

export interface IOrderRepository {
  findAll(workspaceId: string, filters?: OrderFilters): Promise<PaginatedOrders>;
  findById(id: string, workspaceId: string): Promise<Order | null>;
  findByOrderCode(orderCode: string, workspaceId: string): Promise<Order | null>;
  findByCustomerId(customerId: string, workspaceId: string): Promise<Order[]>;
  create(order: Order): Promise<Order>;
  update(id: string, order: Partial<Order>, workspaceId: string): Promise<Order | null>;
  delete(id: string, workspaceId: string): Promise<void>;
  updateStatus(id: string, status: OrderStatus, workspaceId: string): Promise<Order | null>;
  // Payment status is now handled by PaymentDetails table
  getOrdersByDateRange(workspaceId: string, startDate: Date, endDate: Date): Promise<Order[]>;
  getOrdersCount(workspaceId: string, filters?: OrderFilters): Promise<number>;
  getTotalRevenue(workspaceId: string, filters?: OrderFilters): Promise<number>;
  findLatestProcessingByCustomer(customerId: string, workspaceId: string): Promise<Order | null>;
}