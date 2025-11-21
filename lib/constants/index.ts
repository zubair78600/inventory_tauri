/**
 * Application-wide constants
 */

// Application metadata
export const APP_NAME = 'Inventory Management System';
export const APP_VERSION = '1.0.0';
export const APP_DESCRIPTION = 'Comprehensive inventory and billing management system';

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

// Stock alert thresholds
export const LOW_STOCK_THRESHOLD = 10;
export const CRITICAL_STOCK_THRESHOLD = 5;

// Currency and locale
export const DEFAULT_CURRENCY = 'INR';
export const DEFAULT_LOCALE = 'en-IN';

// GST rates (India)
export const GST_RATES = {
  ZERO: 0,
  FIVE: 5,
  TWELVE: 12,
  EIGHTEEN: 18,
  TWENTY_EIGHT: 28,
} as const;

// Payment terms (in days)
export const PAYMENT_TERMS = {
  IMMEDIATE: 0,
  NET_15: 15,
  NET_30: 30,
  NET_45: 45,
  NET_60: 60,
} as const;

// Customer/Supplier status
export const ENTITY_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
} as const;

// Transaction types
export const TRANSACTION_TYPES = {
  CREDIT: 'credit',
  DEBIT: 'debit',
  PAYMENT: 'payment',
  REFUND: 'refund',
} as const;

// API response messages
export const API_MESSAGES = {
  SUCCESS: 'Operation completed successfully',
  ERROR: 'An error occurred',
  NOT_FOUND: 'Resource not found',
  UNAUTHORIZED: 'Unauthorized access',
  VALIDATION_ERROR: 'Validation failed',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
} as const;

// Date formats
export const DATE_FORMATS = {
  DISPLAY: 'MMM DD, YYYY',
  INPUT: 'YYYY-MM-DD',
  FULL: 'MMMM DD, YYYY HH:mm:ss',
  TIME: 'HH:mm:ss',
} as const;

// Report types
export const REPORT_TYPES = {
  SALES: 'sales',
  INVENTORY: 'inventory',
  CUSTOMER: 'customer',
  SUPPLIER: 'supplier',
  FINANCIAL: 'financial',
} as const;

// Export formats
export const EXPORT_FORMATS = {
  PDF: 'pdf',
  CSV: 'csv',
  EXCEL: 'xlsx',
} as const;
