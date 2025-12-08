/**
 * Tauri API utilities
 * Provides type-safe wrappers for calling Tauri commands
 */

import { invoke } from '@tauri-apps/api/core';

export interface PaginatedResult<T> {
  items: T[];
  total_count: number;
}

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
  image_path: string | null;
  total_sold?: number;
  initial_stock_sold?: number;
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
  image_path: string | null;
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
  state: string | null;
  district: string | null;
  town: string | null;
  created_at: string;
  updated_at: string;
  image_path: string | null;
  invoice_count?: number;
  last_billed?: string | null;
}

export interface CreateCustomerInput {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  place: string | null;
  state: string | null;
  district: string | null;
  town: string | null;
}

export interface UpdateCustomerInput {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  place: string | null;
  state: string | null;
  district: string | null;
  town: string | null;
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

// =============================================
// NEW ANALYTICS TYPES
// =============================================

export interface SalesAnalytics {
  total_revenue: number;
  total_orders: number;
  avg_order_value: number;
  total_tax: number;
  total_discount: number;
  gross_profit: number;
  previous_period_revenue: number;
  previous_period_orders: number;
  revenue_change_percent: number;
  orders_change_percent: number;
}

export interface RevenueTrendPoint {
  date: string;
  revenue: number;
  order_count: number;
  avg_order_value: number;
}

export interface TopProduct {
  product_id: number;
  product_name: string;
  sku: string;
  revenue: number;
  quantity_sold: number;
  order_count: number;
}

export interface PaymentMethodBreakdown {
  payment_method: string;
  total_amount: number;
  order_count: number;
  percentage: number;
}

export interface RegionSales {
  state: string;
  district: string | null;
  revenue: number;
  order_count: number;
}

export interface CustomerAnalytics {
  total_customers: number;
  new_customers: number;
  repeat_customers: number;
  repeat_rate: number;
  avg_lifetime_value: number;
}

export interface TopCustomer {
  customer_id: number;
  customer_name: string;
  phone: string | null;
  total_spent: number;
  order_count: number;
  avg_order_value: number;
}

export interface CustomerTrendPoint {
  date: string;
  new_customers: number;
  cumulative_customers: number;
}

export interface InventoryHealth {
  total_products: number;
  low_stock_count: number;
  out_of_stock_count: number;
  healthy_stock_count: number;
  total_valuation: number;
  avg_stock_level: number;
}

export interface LowStockAlert {
  id: number;
  name: string;
  sku: string;
  stock_quantity: number;
  selling_price: number | null;
  avg_daily_sales: number;
  days_until_stockout: number | null;
}

export interface PurchaseAnalytics {
  total_purchases: number;
  total_paid: number;
  pending_payments: number;
  active_suppliers: number;
  purchase_order_count: number;
}

export interface CashflowPoint {
  date: string;
  sales: number;
  purchases: number;
  net: number;
}

export interface TopSupplier {
  supplier_id: number;
  supplier_name: string;
  total_spent: number;
  products_count: number;
  orders_count: number;
}

export interface StateTax {
  state: string;
  tax_amount: number;
  invoice_count: number;
}

export interface TaxSummary {
  total_tax: number;
  cgst_total: number;
  sgst_total: number;
  igst_total: number;
  by_state: StateTax[];
}

export interface DiscountAnalysis {
  total_discounts: number;
  discount_percentage: number;
  orders_with_discount: number;
  avg_discount_per_order: number;
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
  item_count?: number;
  quantity?: number; // Quantity of specific product (context-dependent)
}

export interface ProductSalesSummary {
  total_quantity: number;
  total_amount: number;
  invoice_count: number;
}

export interface ProductPurchaseSummary {
  total_quantity: number;
  total_value: number;
  purchase_orders: number;
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

export interface UpdateInvoiceInput {
  id: number;
  customer_id?: number | null;
  payment_method?: string | null;
  created_at?: string | null;
  status?: string | null;
}

/**
 * Product Commands
 */
export const productCommands = {
  /**
   * Get all products, optionally filtered by search query
   */
  /**
   * Get all products, optionally filtered by search query
   */
  getAll: async (page: number = 1, pageSize: number = 50, search?: string): Promise<PaginatedResult<Product>> => {
    return await invoke<PaginatedResult<Product>>('get_products', { search, page, pageSize });
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
  getTopSelling: async (limit: number, page: number = 1): Promise<Product[]> => {
    return await invoke<Product[]>('get_top_selling_products', { limit, page });
  },
  getByIds: async (ids: number[]): Promise<Product[]> => {
    return await invoke<Product[]>('get_products_by_ids', { ids });
  }
};

/**
 * Supplier Commands
 */
export const supplierCommands = {
  /**
   * Get all suppliers, optionally filtered by search query
   */
  /**
   * Get all suppliers, optionally filtered by search query
   */
  getAll: async (page: number = 1, pageSize: number = 50, search?: string): Promise<PaginatedResult<Supplier>> => {
    return await invoke<PaginatedResult<Supplier>>('get_suppliers', { search, page, pageSize });
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
  /**
   * Get all customers, optionally filtered by search query
   */
  getAll: async (page: number = 1, pageSize: number = 50, search?: string): Promise<PaginatedResult<Customer>> => {
    return await invoke<PaginatedResult<Customer>>('get_customers', { search, page, pageSize });
  },

  /**
   * Search for customers (alias for getAll with query)
   */
  /**
   * Search for customers (alias for getAll with query)
   */
  search: async (query: string, page: number = 1, pageSize: number = 50): Promise<PaginatedResult<Customer>> => {
    return await invoke<PaginatedResult<Customer>>('get_customers', { search: query, page, pageSize });
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

  // =============================================
  // NEW ANALYTICS COMMANDS
  // =============================================

  /**
   * Get sales analytics with date filtering and period comparison
   */
  getSalesAnalytics: async (startDate: string, endDate: string): Promise<SalesAnalytics> => {
    return await invoke<SalesAnalytics>('get_sales_analytics', { startDate, endDate });
  },

  /**
   * Get revenue trend data for charts
   */
  getRevenueTrend: async (
    startDate: string,
    endDate: string,
    granularity: 'daily' | 'weekly' | 'monthly' = 'daily'
  ): Promise<RevenueTrendPoint[]> => {
    return await invoke<RevenueTrendPoint[]>('get_revenue_trend', { startDate, endDate, granularity });
  },

  /**
   * Get top products by revenue
   */
  getTopProducts: async (startDate: string, endDate: string, limit: number = 10): Promise<TopProduct[]> => {
    return await invoke<TopProduct[]>('get_top_products', { startDate, endDate, limit });
  },

  /**
   * Get sales breakdown by payment method
   */
  getSalesByPaymentMethod: async (startDate: string, endDate: string): Promise<PaymentMethodBreakdown[]> => {
    return await invoke<PaymentMethodBreakdown[]>('get_sales_by_payment_method', { startDate, endDate });
  },

  /**
   * Get sales by region (state)
   */
  getSalesByRegion: async (startDate: string, endDate: string): Promise<RegionSales[]> => {
    return await invoke<RegionSales[]>('get_sales_by_region', { startDate, endDate });
  },

  /**
   * Get customer analytics
   */
  getCustomerAnalytics: async (startDate: string, endDate: string): Promise<CustomerAnalytics> => {
    return await invoke<CustomerAnalytics>('get_customer_analytics', { startDate, endDate });
  },

  /**
   * Get top customers by spend
   */
  getTopCustomers: async (startDate: string, endDate: string, limit: number = 10): Promise<TopCustomer[]> => {
    return await invoke<TopCustomer[]>('get_top_customers', { startDate, endDate, limit });
  },

  /**
   * Get customer acquisition trend
   */
  getCustomerTrend: async (
    startDate: string,
    endDate: string,
    granularity: 'daily' | 'weekly' | 'monthly' = 'daily'
  ): Promise<CustomerTrendPoint[]> => {
    return await invoke<CustomerTrendPoint[]>('get_customer_trend', { startDate, endDate, granularity });
  },

  /**
   * Get inventory health metrics
   */
  getInventoryHealth: async (): Promise<InventoryHealth> => {
    return await invoke<InventoryHealth>('get_inventory_health');
  },

  /**
   * Get low stock alerts with sales velocity
   */
  getLowStockAlerts: async (): Promise<LowStockAlert[]> => {
    return await invoke<LowStockAlert[]>('get_low_stock_alerts');
  },

  /**
   * Get purchase analytics
   */
  getPurchaseAnalytics: async (startDate: string, endDate: string): Promise<PurchaseAnalytics> => {
    return await invoke<PurchaseAnalytics>('get_purchase_analytics', { startDate, endDate });
  },

  /**
   * Get cashflow trend (sales vs purchases)
   */
  getCashflowTrend: async (
    startDate: string,
    endDate: string,
    granularity: 'daily' | 'weekly' | 'monthly' = 'daily'
  ): Promise<CashflowPoint[]> => {
    return await invoke<CashflowPoint[]>('get_cashflow_trend', { startDate, endDate, granularity });
  },

  /**
   * Get top suppliers by spend
   */
  getTopSuppliers: async (startDate: string, endDate: string, limit: number = 10): Promise<TopSupplier[]> => {
    return await invoke<TopSupplier[]>('get_top_suppliers', { startDate, endDate, limit });
  },

  /**
   * Get tax summary (GST breakdown)
   */
  getTaxSummary: async (startDate: string, endDate: string): Promise<TaxSummary> => {
    return await invoke<TaxSummary>('get_tax_summary', { startDate, endDate });
  },

  /**
   * Get discount analysis
   */
  getDiscountAnalysis: async (startDate: string, endDate: string): Promise<DiscountAnalysis> => {
    return await invoke<DiscountAnalysis>('get_discount_analysis', { startDate, endDate });
  },
};

/**
 * Invoice Commands
 */
export const invoiceCommands = {
  /**
   * Get all invoices, optionally filtered by customer
   */
  /**
   * Get all invoices with pagination, search, and optional customer filter
   */
  getAll: async (page: number = 1, pageSize: number = 50, search?: string, customerId?: number): Promise<PaginatedResult<Invoice>> => {
    return await invoke<PaginatedResult<Invoice>>('get_invoices', { page, pageSize, search, customer_id: customerId });
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
   * Get aggregated purchase summary for a product
   */
  getProductPurchaseSummary: async (productId: number): Promise<ProductPurchaseSummary> => {
    return await invoke<ProductPurchaseSummary>('get_product_purchase_summary', { productId });
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

  /**
   * Update an invoice (metadata only)
   */
  update: async (input: UpdateInvoiceInput): Promise<Invoice> => {
    return await invoke<Invoice>('update_invoice', { input });
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

// =============================================
// PURCHASE ORDER TYPES
// =============================================

export interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier_id: number;
  order_date: string;
  expected_delivery_date: string | null;
  received_date: string | null;
  status: 'draft' | 'ordered' | 'received' | 'cancelled';
  total_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderWithDetails {
  id: number;
  po_number: string;
  supplier_id: number;
  supplier_name: string;
  order_date: string;
  expected_delivery_date: string | null;
  received_date: string | null;
  status: 'draft' | 'ordered' | 'received' | 'cancelled';
  total_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items_count: number;
  quantity?: number; // Quantity of specific product (context-dependent)
  total_paid: number;
  total_pending: number;
}

export interface PurchaseOrderItemWithProduct {
  id: number;
  po_id: number;
  product_id: number;
  product_name: string;
  sku: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  selling_price?: number;
  quantity_sold?: number;
  sold_revenue?: number;
  created_at: string;
}

export interface PurchaseOrderComplete {
  purchase_order: PurchaseOrder;
  supplier: Supplier;
  items: PurchaseOrderItemWithProduct[];
  payments: SupplierPayment[];
  total_paid: number;
  total_pending: number;
}

export interface PurchaseOrderItemInput {
  product_id: number;
  quantity: number;
  unit_cost: number;
}

export interface CreatePurchaseOrderInput {
  supplier_id: number;
  items: PurchaseOrderItemInput[];
  order_date?: string | null;
  expected_delivery_date?: string | null;
  notes?: string | null;
}

// =============================================
// FIFO INVENTORY TYPES
// =============================================

export interface InventoryBatch {
  id: number;
  product_id: number;
  po_item_id: number | null;
  quantity_remaining: number;
  unit_cost: number;
  purchase_date: string;
  created_at: string;
}

export interface InventoryBatchWithDetails {
  id: number;
  product_id: number;
  po_item_id: number | null;
  po_number: string | null;
  quantity_remaining: number;
  unit_cost: number;
  batch_value: number;
  purchase_date: string;
  created_at: string;
}

export interface InventoryTransaction {
  id: number;
  product_id: number;
  transaction_type: 'purchase' | 'sale' | 'adjustment';
  quantity_change: number;
  unit_cost: number | null;
  reference_type: string | null;
  reference_id: number | null;
  balance_after: number;
  transaction_date: string;
  notes: string | null;
  created_at: string;
}

export interface FifoCostBreakdown {
  batch_id: number;
  quantity_used: number;
  unit_cost: number;
  subtotal: number;
}

export interface FifoSaleResult {
  total_cogs: number;
  breakdown: FifoCostBreakdown[];
  batches_depleted: number[];
}

// =============================================
// PURCHASE ORDER COMMANDS
// =============================================

/**
 * Purchase Order Commands
 */
export const purchaseOrderCommands = {
  /**
   * Create a new purchase order with items
   */
  create: async (input: CreatePurchaseOrderInput): Promise<PurchaseOrder> => {
    return await invoke<PurchaseOrder>('create_purchase_order', { input });
  },

  /**
   * Get all purchase orders, optionally filtered by supplier or status
   */
  getAll: async (supplierId?: number, status?: string): Promise<PurchaseOrderWithDetails[]> => {
    return await invoke<PurchaseOrderWithDetails[]>('get_purchase_orders', {
      supplierId: supplierId ?? null,
      status: status ?? null,
    });
  },

  /**
   * Get a single purchase order with complete details
   */
  getById: async (poId: number): Promise<PurchaseOrderComplete> => {
    return await invoke<PurchaseOrderComplete>('get_purchase_order_by_id', { poId });
  },

  /**
   * Update purchase order status
   */
  updateStatus: async (
    poId: number,
    status: 'draft' | 'ordered' | 'received' | 'cancelled',
    receivedDate?: string | null
  ): Promise<PurchaseOrder> => {
    return await invoke<PurchaseOrder>('update_purchase_order_status', {
      poId,
      status,
      receivedDate: receivedDate ?? null,
    });
  },

  /**
   * Add a payment to a purchase order
   */
  addPayment: async (input: {
    po_id: number;
    amount: number;
    payment_method?: string | null;
    note?: string | null;
    paid_at?: string | null;
  }): Promise<number> => {
    return await invoke<number>('add_payment_to_purchase_order', {
      poId: input.po_id,
      amount: input.amount,
      paymentMethod: input.payment_method ?? null,
      note: input.note ?? null,
      paidAt: input.paid_at ?? null,
    });
  },

  /**
   * Get purchase history for a specific product
   */
  getProductPurchaseHistory: async (productId: number): Promise<PurchaseOrderItemWithProduct[]> => {
    return await invoke<PurchaseOrderItemWithProduct[]>('get_product_purchase_history', {
      productId,
    });
  },
};

// =============================================
// DATA MIGRATION TYPES & COMMANDS
// =============================================

export interface MigrationResult {
  products_migrated: number;
  purchase_orders_created: number;
  batches_created: number;
  transactions_created: number;
  errors: string[];
  details: string[];
}

export interface MigrationStatus {
  total_products: number;
  products_with_batches: number;
  products_needing_migration: number;
  migration_supplier_exists: boolean;
  migration_required: boolean;
}

export interface InconsistentProduct {
  id: number;
  name: string;
  sku: string;
  stock_quantity: number;
  batch_total: number;
  difference: number;
}

export interface ValidationResult {
  total_products_checked: number;
  consistent_products: number;
  inconsistent_products: InconsistentProduct[];
}

/**
 * Data Migration Commands
 * Used to migrate existing products to the new Purchase Order and FIFO system
 */
export const migrationCommands = {
  /**
   * Migrate existing products with stock to the new PO/FIFO system
   * Creates migration POs and inventory batches for products with stock
   */
  migrateExistingProducts: async (): Promise<MigrationResult> => {
    return await invoke<MigrationResult>('migrate_existing_products');
  },

  /**
   * Check migration status - see which products need migration
   */
  checkMigrationStatus: async (): Promise<MigrationStatus> => {
    return await invoke<MigrationStatus>('check_migration_status');
  },

  /**
   * Validate data consistency after migration
   * Checks if stock quantities match batch totals
   */
  validateMigration: async (): Promise<ValidationResult> => {
    return await invoke<ValidationResult>('validate_migration');
  },
};

// =============================================
// IMAGE TYPES & COMMANDS
// =============================================

export interface GoogleImageResult {
  title: string;
  link: string;           // Full-size image URL
  thumbnail_link: string; // Small preview from Google
  display_link: string;   // Source website
}

/**
 * Image Commands
 * For managing product photos - upload, download from URL, search Google Images
 */
export const imageCommands = {
  /**
   * Save an uploaded image file for a product
   * @param productId - The product ID
   * @param fileData - The image file data as Uint8Array
   * @param fileExtension - File extension (jpg, png, gif, webp)
   * @returns The saved image filename
   */
  saveProductImage: async (
    productId: number,
    fileData: number[],
    fileExtension: string
  ): Promise<string> => {
    return await invoke<string>('save_product_image', {
      productId,
      fileData,
      fileExtension,
    });
  },

  /**
   * Download an image from a URL and save it for a product
   * @param productId - The product ID
   * @param imageUrl - The URL to download from
   * @returns The saved image filename
   */
  downloadProductImage: async (
    productId: number,
    imageUrl: string
  ): Promise<string> => {
    return await invoke<string>('download_product_image', {
      productId,
      imageUrl,
    });
  },

  /**
   * Get the full filesystem path for a product's image
   * @param productId - The product ID
   * @param thumbnail - Whether to get the thumbnail (80x80) or full image
   * @returns The full path or null if no image
   */
  getProductImagePath: async (
    productId: number,
    thumbnail: boolean = false
  ): Promise<string | null> => {
    return await invoke<string | null>('get_product_image_path', {
      productId,
      thumbnail,
    });
  },

  /**
   * Delete a product's image file
   * @param productId - The product ID
   */
  deleteProductImage: async (productId: number): Promise<void> => {
    return await invoke<void>('delete_product_image', { productId });
  },

  /**
   * Search Google Images for product photos
   * @param query - Search query (e.g., product name)
   * @param limit - Max results (1-10, default 10)
   * @returns Array of image search results
   */
  searchGoogleImages: async (
    query: string,
    limit: number = 10
  ): Promise<GoogleImageResult[]> => {
    return await invoke<GoogleImageResult[]>('search_google_images', {
      query,
      limit,
    });
  },

  /**
   * Get the pictures directory path
   * @returns The full path to the pictures-Inventry folder
   */
  getPicturesDirectory: async (): Promise<string> => {
    return await invoke<string>('get_pictures_directory');
  },

  /**
   * Save a cropped image (creates generic backup of original if needed)
   */
  saveCroppedImage: async (productId: number, fileData: number[], extension: string): Promise<string> => {
    return await invoke<string>('save_cropped_image', { productId, fileData, fileExtension: extension });
  },

  /**
   * Get the original image path if it exists, otherwise the current image path
   */
  getOriginalImagePath: async (productId: number): Promise<string | null> => {
    return await invoke<string | null>('get_original_image_path', { productId });
  },

  // Supplier Image Commands
  saveSupplierImage: async (supplierId: number, fileData: number[], fileExtension: string): Promise<string> => {
    return await invoke<string>('save_supplier_image', { supplierId, fileData, fileExtension });
  },
  getSupplierImagePath: async (supplierId: number, thumbnail: boolean = false): Promise<string | null> => {
    return await invoke<string | null>('get_supplier_image_path', { supplierId, thumbnail });
  },
  deleteSupplierImage: async (supplierId: number): Promise<void> => {
    return await invoke<void>('delete_supplier_image', { supplierId });
  },

  // Customer Image Commands
  saveCustomerImage: async (customerId: number, fileData: number[], fileExtension: string): Promise<string> => {
    return await invoke<string>('save_customer_image', { customerId, fileData, fileExtension });
  },
  getCustomerImagePath: async (customerId: number, thumbnail: boolean = false): Promise<string | null> => {
    return await invoke<string | null>('get_customer_image_path', { customerId, thumbnail });
  },
  deleteCustomerImage: async (customerId: number): Promise<void> => {
    return await invoke<void>('delete_customer_image', { customerId });
  },
};

// =============================================
// SETTINGS COMMANDS
// =============================================

/**
 * Settings Commands
 * For managing app settings like Google API credentials
 */
export const settingsCommands = {
  /**
   * Get a single setting value by key
   * @param key - Setting key (e.g., 'google_api_key', 'google_cx_id')
   * @returns The setting value or null if not set
   */
  get: async (key: string): Promise<string | null> => {
    return await invoke<string | null>('get_app_setting', { key });
  },

  /**
   * Set a setting value (insert or update)
   * @param key - Setting key
   * @param value - Setting value
   */
  set: async (key: string, value: string): Promise<void> => {
    return await invoke<void>('set_app_setting', { key, value });
  },

  /**
   * Get all settings as a key-value map
   * @returns Map of all settings
   */
  getAll: async (): Promise<Record<string, string>> => {
    return await invoke<Record<string, string>>('get_all_settings');
  },

  /**
   * Delete a setting by key
   * @param key - Setting key to delete
   */
  delete: async (key: string): Promise<void> => {
    return await invoke<void>('delete_app_setting', { key });
  },

  /**
   * Export all settings as JSON string
   */
  exportJson: async (): Promise<string> => {
    return await invoke<string>('export_settings_json');
  },

  /**
   * Import settings from JSON string
   * @param jsonContent - The JSON string to import
   * @returns Number of settings imported
   */
  importJson: async (jsonContent: string): Promise<number> => {
    return await invoke<number>('import_settings_json', { jsonContent });
  },
};
