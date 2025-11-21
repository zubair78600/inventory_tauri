/**
 * Tauri API utilities
 * Provides type-safe wrappers for calling Tauri commands
 */

import { invoke } from '@tauri-apps/api/core';

export interface Product {
  id: number;
  name: string;
  sku: string;
  price: number;
  stock_quantity: number;
  supplier_id: number | null;
}

export interface CreateProductInput {
  name: string;
  sku: string;
  price: number;
  stock_quantity: number;
  supplier_id: number | null;
}

export interface UpdateProductInput {
  id: number;
  name: string;
  sku: string;
  price: number;
  stock_quantity: number;
  supplier_id: number | null;
}

export interface Supplier {
  id: number;
  name: string;
  contact_info: string | null;
}

export interface CreateSupplierInput {
  name: string;
  contact_info: string | null;
}

export interface UpdateSupplierInput {
  id: number;
  name: string;
  contact_info: string | null;
}

export interface Customer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomerInput {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export interface UpdateCustomerInput {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export interface DashboardStats {
  total_products: number;
  total_suppliers: number;
  total_customers: number;
  total_invoices: number;
  low_stock_products: number;
  total_revenue: number;
}

export interface LowStockProduct {
  id: number;
  name: string;
  sku: string;
  stock_quantity: number;
}

/**
 * Product Commands
 */
export const productCommands = {
  /**
   * Get all products, optionally filtered by search query
   */
  getAll: async (search?: string): Promise<Product[]> => {
    return await invoke<Product[]>('get_products', { search });
  },

  /**
   * Get a single product by ID
   */
  getById: async (id: number): Promise<Product> => {
    return await invoke<Product>('get_product', { id });
  },

  /**
   * Create a new product
   */
  create: async (input: CreateProductInput): Promise<Product> => {
    return await invoke<Product>('create_product', { input });
  },

  /**
   * Update an existing product
   */
  update: async (input: UpdateProductInput): Promise<Product> => {
    return await invoke<Product>('update_product', { input });
  },

  /**
   * Delete a product by ID
   */
  delete: async (id: number): Promise<void> => {
    return await invoke<void>('delete_product', { id });
  },

  /**
   * Add mock product data for testing
   */
  addMockData: async (): Promise<string> => {
    return await invoke<string>('add_mock_products');
  },
};

/**
 * Supplier Commands
 */
export const supplierCommands = {
  /**
   * Get all suppliers, optionally filtered by search query
   */
  getAll: async (search?: string): Promise<Supplier[]> => {
    return await invoke<Supplier[]>('get_suppliers', { search });
  },

  /**
   * Get a single supplier by ID
   */
  getById: async (id: number): Promise<Supplier> => {
    return await invoke<Supplier>('get_supplier', { id });
  },

  /**
   * Create a new supplier
   */
  create: async (input: CreateSupplierInput): Promise<Supplier> => {
    return await invoke<Supplier>('create_supplier', { input });
  },

  /**
   * Update an existing supplier
   */
  update: async (input: UpdateSupplierInput): Promise<Supplier> => {
    return await invoke<Supplier>('update_supplier', { input });
  },

  /**
   * Delete a supplier by ID
   */
  delete: async (id: number): Promise<void> => {
    return await invoke<void>('delete_supplier', { id });
  },

  /**
   * Add mock supplier data for testing
   */
  addMockData: async (): Promise<string> => {
    return await invoke<string>('add_mock_suppliers');
  },
};

/**
 * Customer Commands
 */
export const customerCommands = {
  /**
   * Get all customers, optionally filtered by search query
   */
  getAll: async (search?: string): Promise<Customer[]> => {
    return await invoke<Customer[]>('get_customers', { search });
  },

  /**
   * Get a single customer by ID
   */
  getById: async (id: number): Promise<Customer> => {
    return await invoke<Customer>('get_customer', { id });
  },

  /**
   * Create a new customer
   */
  create: async (input: CreateCustomerInput): Promise<Customer> => {
    return await invoke<Customer>('create_customer', { input });
  },

  /**
   * Update an existing customer
   */
  update: async (input: UpdateCustomerInput): Promise<Customer> => {
    return await invoke<Customer>('update_customer', { input });
  },

  /**
   * Delete a customer by ID
   */
  delete: async (id: number): Promise<void> => {
    return await invoke<void>('delete_customer', { id });
  },

  /**
   * Add mock customer data for testing
   */
  addMockData: async (): Promise<string> => {
    return await invoke<string>('add_mock_customers');
  },
};

/**
 * Analytics Commands
 */
export const analyticsCommands = {
  /**
   * Get dashboard statistics
   */
  getDashboardStats: async (): Promise<DashboardStats> => {
    return await invoke<DashboardStats>('get_dashboard_stats');
  },

  /**
   * Get low stock products (stock < 10)
   */
  getLowStockProducts: async (): Promise<LowStockProduct[]> => {
    return await invoke<LowStockProduct[]>('get_low_stock_products');
  },
};
