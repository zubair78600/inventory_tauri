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
