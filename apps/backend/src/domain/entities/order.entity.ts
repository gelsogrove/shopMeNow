import { ItemType, OrderStatus, PaymentMethod } from '@prisma/client';
import { Customer } from './customer.entity';
import { Product } from './product.entity';
import { Service } from './service.entity';

export interface OrderItem {
  id: string;
  orderId: string;
  itemType: ItemType; // PRODUCT or SERVICE
  productId?: string; // Optional for services
  serviceId?: string; // Optional for products
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  productVariant: any | null;
  product?: Product;
  service?: Service;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShippingAddress {
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface BillingAddress {
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  phone?: string;
  company?: string;
  vatNumber?: string;
}

export class Order {
  id: string;
  orderCode: string;
  customerId: string;
  workspaceId: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod | null;
  totalAmount: number;
  shippingAmount: number;
  taxAmount: number;
  shippingAddress: ShippingAddress | null;
  billingAddress: BillingAddress | null;
  notes: string | null;
  discountCode: string | null;
  discountAmount: number;
  createdAt: Date;
  updatedAt: Date;
  customer?: Customer;
  items?: OrderItem[];
  trackingNumber?: string | null;

  constructor(data: Partial<Order>) {
    this.id = data.id || '';
    this.orderCode = data.orderCode || this.generateOrderCode();
    this.customerId = data.customerId || '';
    this.workspaceId = data.workspaceId || '';
    this.status = data.status || OrderStatus.PENDING;
    this.paymentMethod = data.paymentMethod || null;
    this.totalAmount = data.totalAmount || 0;
    this.shippingAmount = data.shippingAmount || 0;
    this.taxAmount = data.taxAmount || 0;
    this.shippingAddress = data.shippingAddress || null;
    this.billingAddress = data.billingAddress || null;
    this.notes = data.notes || null;
    this.discountCode = data.discountCode || null;
    this.discountAmount = data.discountAmount || 0;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.customer = data.customer;
    this.items = data.items || [];
    this.trackingNumber = data.trackingNumber || null;
  }

  private generateOrderCode(): string {
    // Generate 5 random uppercase letters
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let orderCode = '';
    
    for (let i = 0; i < 5; i++) {
      orderCode += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    
    return orderCode;
  }

  getTotalItemsCount(): number {
    return this.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  }

  getSubtotal(): number {
    return this.totalAmount - this.shippingAmount - this.taxAmount + this.discountAmount;
  }

  updateStatus(status: OrderStatus): Order {
    return new Order({
      ...this,
      status,
      updatedAt: new Date()
    });
  }

  calculateTotalAmount(): number {
    const itemsTotal = this.items?.reduce((sum, item) => sum + item.totalPrice, 0) || 0;
    return itemsTotal + this.shippingAmount + this.taxAmount - this.discountAmount;
  }

  canBeCancelled(): boolean {
    return this.status === OrderStatus.PENDING || this.status === OrderStatus.CONFIRMED;
  }

  isComplete(): boolean {
    return this.status === OrderStatus.DELIVERED;
  }

  // Helper methods for services
  hasServices(): boolean {
    return this.items?.some(item => item.itemType === ItemType.SERVICE) || false;
  }

  hasProducts(): boolean {
    return this.items?.some(item => item.itemType === ItemType.PRODUCT) || false;
  }

  getServices(): OrderItem[] {
    return this.items?.filter(item => item.itemType === ItemType.SERVICE) || [];
  }

  getProducts(): OrderItem[] {
    return this.items?.filter(item => item.itemType === ItemType.PRODUCT) || [];
  }
}