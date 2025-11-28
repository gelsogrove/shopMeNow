import { Customer, CustomerProps } from "../entities/customer.entity";

/**
 * Interface for Customer Repository
 * Defines all data operations for Customer entity
 */
export interface ICustomerRepository {
  /**
   * Find all customers in a workspace
   */
  findAll(workspaceId: string): Promise<Customer[]>;
  
  /**
   * Find all active customers in a workspace
   */
  findActive(workspaceId: string): Promise<Customer[]>;

  /**
   * Find a single customer by ID and workspace
   */
  findById(id: string, workspaceId: string): Promise<Customer | null>;
  
  /**
   * Find a customer by email
   */
  findByEmail(email: string, workspaceId: string): Promise<Customer | null>;
  
  /**
   * Find a customer by phone
   */
  findByPhone(phone: string, workspaceId: string): Promise<Customer | null>;
  
  /**
   * Create a new customer
   */
  create(data: CustomerProps): Promise<Customer>;
  
  /**
   * Update an existing customer
   */
  update(id: string, workspaceId: string, data: Partial<CustomerProps>): Promise<Customer>;
  
  /**
   * Soft delete a customer (mark as inactive)
   */
  softDelete(id: string, workspaceId: string): Promise<boolean>;
  
  /**
   * Hard delete a customer (remove from database)
   */
  hardDelete(id: string, workspaceId: string): Promise<boolean>;
  
  /**
   * Count customers with a specific name in a workspace
   */
  countByName(name: string, workspaceId: string): Promise<number>;
  
  /**
   * Check if customer has related records (orders, chat sessions)
   */
  hasRelatedRecords(id: string): Promise<boolean>;
  
  /**
   * Delete related records before deleting the customer
   */
  deleteRelatedRecords(id: string): Promise<void>;
} 