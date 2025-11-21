import type { Customer, CustomerInvoice, DashboardSale, Invoice, Product, Supplier } from '@/types';
import type {
  Customer as PrismaCustomer,
  Invoice as PrismaInvoice,
  Product as PrismaProduct,
  Supplier as PrismaSupplier,
} from '@prisma/client';

export const toProductResponse = (product: PrismaProduct): Product => ({
  id: product.id,
  name: product.name,
  sku: product.sku,
  price: product.price,
  stock_quantity: product.stockQuantity,
  supplier_id: product.supplierId ?? null,
});

export const toSupplierResponse = (supplier: PrismaSupplier): Supplier => ({
  id: supplier.id,
  name: supplier.name,
  contact_info: supplier.contactInfo ?? null,
});

export const toCustomerResponse = (customer: Partial<PrismaCustomer> & Pick<PrismaCustomer, 'id' | 'name'>): Customer => ({
  id: customer.id,
  name: customer.name,
  email: customer.email ?? null,
  phone: customer.phone ?? null,
  address: customer.address ?? null,
  created_at: customer.createdAt?.toISOString?.() ?? '',
  updated_at: customer.updatedAt?.toISOString?.() ?? '',
});

export const toInvoiceResponse = (
  invoice: PrismaInvoice & {
    customer?: { name: string | null; phone?: string | null } | null;
    _count?: { items?: number };
  }
): Invoice => ({
  id: invoice.id,
  invoice_number: invoice.invoiceNumber,
  customer_id: invoice.customerId ?? null,
  total_amount: invoice.totalAmount,
  tax_amount: invoice.taxAmount,
  discount_amount: invoice.discountAmount,
  payment_method: invoice.paymentMethod ?? null,
  created_at: invoice.createdAt.toISOString(),
  customer_name: invoice.customer?.name ?? null,
  customer_phone: invoice.customer?.phone ?? null,
  item_count: invoice._count?.items ?? 0,
});

export const toDashboardSale = (
  invoice: PrismaInvoice & { customer?: { name: string | null } | null }
): DashboardSale => ({
  id: invoice.id,
  invoice_number: invoice.invoiceNumber,
  total_amount: invoice.totalAmount,
  created_at: invoice.createdAt.toISOString(),
  customer_name: invoice.customer?.name ?? null,
});

export const toCustomerInvoice = (
  invoice: PrismaInvoice & { _count?: { items?: number } }
): CustomerInvoice => ({
  id: invoice.id,
  invoice_number: invoice.invoiceNumber,
  total_amount: invoice.totalAmount,
  discount_amount: invoice.discountAmount,
  created_at: invoice.createdAt.toISOString(),
  item_count: invoice._count?.items ?? 0,
});
