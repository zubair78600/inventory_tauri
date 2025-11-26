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
  selling_price: number | null;
  initial_stock: number | null;
  stock_quantity: number;
  supplier_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProductInput {
  name: string;
  sku: string;
  price: number;
  selling_price: number | null;
  stock_quantity: number;
  supplier_id: number | null;
  amount_paid?: number | null;
}

export interface UpdateProductInput {
  id: number;
  name: string;
  sku: string;
  price: number;
  selling_price: number | null;
  stock_quantity: number;
  supplier_id: number | null;
}

export interface Supplier {
  id: number;
  name: string;
  contact_info: string | null;
  address: string | null;
  email: string | null;
  comments: string | null;
  state: string | null;
  place: string | null;
  district: string | null;
  town: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierPayment {
  id: number;
  supplier_id: number;
  product_id: number | null;
  amount: number;
  payment_method: string | null;
  note: string | null;
  paid_at: string;
  created_at: string;
}

export interface SupplierPaymentSummary {
  total_payable: number;
  total_paid: number;
  pending_amount: number;
}

export interface CreateSupplierInput {
  name: string;
  contact_info: string | null;
  address: string | null;
  email: string | null;
  comments: string | null;
  state: string | null;
  district: string | null;
  town: string | null;
}

export interface UpdateSupplierInput {
  id: number;
  name: string;
  contact_info: string | null;
  address: string | null;
  email: string | null;
  comments: string | null;
  state: string | null;
  district: string | null;
  town: string | null;
}

export interface Customer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  place: string | null;
  created_at: string;
  updated_at: string;
  invoice_count?: number;
  last_billed?: string | null;
}

export interface CreateCustomerInput {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  place: string | null;
}

export interface UpdateCustomerInput {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  place: string | null;
}

export interface DashboardSale {
  id: number;
  invoice_number: string;
  total_amount: number;
  created_at: string;
  customer_name: string | null;
}

export interface DashboardStats {
  total_revenue: number;
  total_orders: number;
  low_stock_count: number;
  total_valuation: number;
  recent_sales: DashboardSale[];
}

export interface LowStockProduct {
  id: number;
  name: string;
  sku: string;
  stock_quantity: number;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  customer_id: number | null;
  total_amount: number;
  tax_amount: number;
  discount_amount: number;
  payment_method: string | null;
  created_at: string;
  cgst_amount: number | null;
  fy_year: string | null;
  gst_rate: number | null;
  igst_amount: number | null;
  sgst_amount: number | null;
  state: string | null;
  district: string | null;
  town: string | null;
}

export interface ProductSalesSummary {
  total_quantity: number;
  total_amount: number;
  invoice_count: number;
}

export interface InvoiceItemWithProduct {
  id: number;
  invoice_id: number;
  product_id: number;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: number;
}

export type InvoiceItem = InvoiceItemWithProduct;

export interface InvoiceWithItems {
  invoice: Invoice;
  items: InvoiceItemWithProduct[];
}

export interface CreateInvoiceItemInput {
  product_id: number;
  quantity: number;
  unit_price: number;
}

export interface CreateInvoiceInput {
  customer_id: number | null;
  items: CreateInvoiceItemInput[];
  tax_amount?: number;
  discount_amount?: number;
  payment_method?: string;
  state?: string;
  district?: string;
  town?: string;
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
   * Get all products for a specific supplier
   */
  getBySupplier: async (supplierId: number): Promise<Product[]> => {
    return await invoke<Product[]>('get_products_by_supplier', { supplierId });
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

  /**
   * Get all payment records for a supplier
   */
  getPayments: async (supplierId: number, productId: number): Promise<SupplierPayment[]> => {
    return await invoke<SupplierPayment[]>('get_supplier_payments', { supplierId, productId });
  },

  /**
   * Create a payment entry for a supplier
   */
  addPayment: async (input: {
    supplier_id: number;
    product_id: number;
    amount: number;
    payment_method?: string | null;
    note?: string | null;
    paid_at?: string | null;
  }): Promise<SupplierPayment> => {
    return await invoke<SupplierPayment>('create_supplier_payment', {
      input: {
        ...input,
        payment_method: input.payment_method ?? null,
        note: input.note ?? null,
        paid_at: input.paid_at ?? null,
      },
    });
  },

  /**
   * Delete a payment entry
   */
  deletePayment: async (id: number): Promise<void> => {
    return await invoke<void>('delete_supplier_payment', { id });
  },

  /**
   * Get payment summary (total payable, total paid, pending) for a supplier
   */
  getPaymentSummary: async (supplierId: number, productId: number): Promise<SupplierPaymentSummary> => {
    return await invoke<SupplierPaymentSummary>('get_supplier_payment_summary', {
      supplierId,
      productId,
    });
  },
};

export const customerCommands = {
  /**
   * Get all customers, optionally filtered by search query
   */
  getAll: async (search?: string): Promise<Customer[]> => {
    return await invoke<Customer[]>('get_customers', { search });
  },

  /**
   * Search for customers (alias for getAll with query)
   */
  search: async (query: string): Promise<Customer[]> => {
    return await invoke<Customer[]>('get_customers', { search: query });
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

export interface CustomerInvoice {
  id: number;
  invoice_number: string;
  total_amount: number;
  discount_amount: number;
  created_at: string;
  item_count: number;
}

export interface CustomerProductStat {
  name: string;
  total_qty: number;
}

export interface CustomerReport {
  customer: Customer;
  invoices: CustomerInvoice[];
  products: CustomerProductStat[];
  stats: {
    total_spent: number;
    total_discount: number;
    invoice_count: number;
  };
}

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

  /**
   * Search for customers and get detailed reports
   */
  customerSearch: async (query: string): Promise<CustomerReport[]> => {
    return await invoke<CustomerReport[]>('customer_search', { query });
  },

  /**
   * Get a detailed report for a single customer by ID
   */
  getReport: async (id: number): Promise<CustomerReport> => {
    return await invoke<CustomerReport>('get_customer_report', { id });
  },
};

/**
 * Invoice Commands
 */
export const invoiceCommands = {
  /**
   * Get all invoices, optionally filtered by customer
   */
  getAll: async (customerId?: number): Promise<Invoice[]> => {
    return await invoke<Invoice[]>('get_invoices', { customerId });
  },

  /**
   * Get all invoices containing a specific product
   */
  getByProduct: async (productId: number): Promise<Invoice[]> => {
    return await invoke<Invoice[]>('get_invoices_by_product', { productId });
  },

  /**
   * Get a single invoice with its items
   */
  getById: async (id: number): Promise<InvoiceWithItems> => {
    return await invoke<InvoiceWithItems>('get_invoice', { id });
  },

  /**
   * Get aggregated sales summary for a product
   */
  getProductSalesSummary: async (productId: number): Promise<ProductSalesSummary> => {
    return await invoke<ProductSalesSummary>('get_product_sales_summary', { productId });
  },

  /**
   * Create a new invoice with items (updates stock)
   */
  create: async (input: CreateInvoiceInput): Promise<Invoice> => {
    return await invoke<Invoice>('create_invoice', { input });
  },

  /**
   * Delete an invoice (restores stock)
   */
  delete: async (id: number): Promise<void> => {
    return await invoke<void>('delete_invoice', { id });
  },
};

export interface SearchProduct {
  id: number;
  name: string;
  sku: string;
  price: number;
  stock_quantity: number;
}

export interface SearchCustomer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface SearchSupplier {
  id: number;
  name: string;
  contact_info: string | null;
  address: string | null;
  email: string | null;
  comments: string | null;
  state: string | null;
  place: string | null;
}

export interface SearchInvoice {
  id: number;
  invoice_number: string;
  total_amount: number;
  created_at: string;
}

export interface SearchResult {
  products: SearchProduct[];
  customers: SearchCustomer[];
  suppliers: SearchSupplier[];
  invoices: SearchInvoice[];
}

/**
 * Search Commands
 */
export const searchCommands = {
  /**
   * OmniSearch: Search across all entities
   */
  omnisearch: async (query: string): Promise<SearchResult> => {
    return await invoke<SearchResult>('omnisearch', { query });
  },

  /**
   * Export products to CSV format
   */
  exportProductsCSV: async (): Promise<string> => {
    return await invoke<string>('export_products_csv');
  },

  /**
   * Export customers to CSV format
   */
  exportCustomersCSV: async (): Promise<string> => {
    return await invoke<string>('export_customers_csv');
  },
};
