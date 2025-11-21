/**
 * Application route constants
 */

// Public routes
export const PUBLIC_ROUTES = {
  HOME: '/',
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  FORGOT_PASSWORD: '/auth/forgot-password',
} as const;

// Protected routes
export const PROTECTED_ROUTES = {
  DASHBOARD: '/',

  // Customers
  CUSTOMERS: '/customers',
  CUSTOMER_DETAIL: (id: string) => `/customers/${id}`,

  // Suppliers
  SUPPLIERS: '/suppliers',
  SUPPLIER_DETAIL: (id: string) => `/suppliers/${id}`,

  // Inventory
  INVENTORY: '/inventory',
  PRODUCT_DETAIL: (id: string) => `/inventory/${id}`,

  // Billing
  BILLING: '/billing',
  INVOICE_DETAIL: (id: string) => `/billing/${id}`,

  // Reports
  REPORTS: '/reports',
  REPORT_DETAIL: (type: string) => `/reports/${type}`,

  // Settings
  SETTINGS: '/settings',
  PROFILE: '/settings/profile',
} as const;

// API routes
export const API_ROUTES = {
  // Customers
  CUSTOMERS: '/api/customers',
  CUSTOMER_BY_ID: (id: string) => `/api/customers/${id}`,

  // Suppliers
  SUPPLIERS: '/api/suppliers',
  SUPPLIER_BY_ID: (id: string) => `/api/suppliers/${id}`,

  // Products
  PRODUCTS: '/api/products',
  PRODUCT_BY_ID: (id: string) => `/api/products/${id}`,

  // Invoices
  INVOICES: '/api/invoices',
  INVOICE_BY_ID: (id: string) => `/api/invoices/${id}`,
  INVOICE_PDF: (id: string) => `/api/invoices/${id}/pdf`,

  // Reports
  REPORTS: '/api/reports',
  CUSTOMER_SEARCH: '/api/reports/customer-search',

  // Alerts
  LOW_STOCK_ALERTS: '/api/alerts/low-stock',

  // Analytics
  ANALYTICS: '/api/analytics',

  // Notifications
  EMAIL_NOTIFICATION: '/api/notifications/email',
} as const;
