import { z } from 'zod';

export const productSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  price: z.coerce.number().min(0),
  stock_quantity: z.coerce.number().int().min(0).default(0),
  supplier_id: z.union([z.coerce.number().int().positive(), z.null(), z.literal('')]).optional(),
});

export const customerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().min(3).optional().nullable(),
  address: z.string().optional().nullable(),
});

export const supplierSchema = z.object({
  name: z.string().min(1),
  contact_info: z.string().optional().nullable(),
});

const invoiceItemSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive(),
  unit_price: z.coerce.number().min(0),
});

export const invoiceSchema = z.object({
  customer_id: z.coerce.number().int().positive().optional().nullable(),
  customer_name: z.string().optional(),
  customer_phone: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1),
  tax_amount: z.coerce.number().min(0).optional().default(0),
  discount_amount: z.coerce.number().min(0).optional().default(0),
  payment_method: z.string().optional(),
  origin_state: z.string().optional().nullable(),
  destination_state: z.string().optional().nullable(),
  language: z.string().optional().nullable(),
});
