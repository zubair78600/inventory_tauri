export type Supplier = {
  id: number;
  name: string;
  contact_info: string | null;
  address: string | null;
  email: string | null;
  comments: string | null;
  state: string | null;
  district: string | null;
  town: string | null;
  created_at: string;
  updated_at: string;
};

export type Product = {
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
};

export type Customer = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Invoice = {
  id: number;
  invoice_number: string;
  customer_id: number | null;
  total_amount: number;
  tax_amount: number;
  discount_amount: number;
  payment_method: string | null;
  created_at: string;
  gst_rate?: number | null;
  cgst_amount?: number | null;
  sgst_amount?: number | null;
  igst_amount?: number | null;
  fy_year?: string | null;
  state?: string | null;
  district?: string | null;
  town?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  item_count?: number;
};

export type InvoiceItem = {
  invoice_id?: number;
  product_id: number;
  quantity: number;
  unit_price: number;
};

export type DashboardSale = {
  id: number;
  invoice_number: string;
  total_amount: number;
  created_at: string;
  customer_name: string | null;
};

export type DashboardStats = {
  total_revenue: number;
  total_orders: number;
  low_stock_count: number;
  total_valuation: number;
  recent_sales: DashboardSale[];
};

export type CustomerInvoice = {
  id: number;
  invoice_number: string;
  total_amount: number;
  discount_amount: number;
  created_at: string;
  item_count: number;
};

export type CustomerProductStat = {
  name: string;
  total_qty: number;
};

export type CustomerReport = {
  customer: Customer;
  invoices: CustomerInvoice[];
  products: CustomerProductStat[];
  stats: {
    total_spent: number;
    total_discount: number;
    invoice_count: number;
  };
};
