/**
 * Phone number utilities for WhatsApp integration
 */

/**
 * Format phone number to international format without '+'
 * Handles Indian phone numbers (91 prefix)
 * @param phone - Phone number in any format
 * @returns Formatted phone number (e.g., "919876543210")
 */
export function formatPhoneForWhatsApp(phone: string): string {
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, '');

  // If starts with 0, remove it (common in local Indian numbers)
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  // If doesn't start with country code (91 for India), add it
  if (!cleaned.startsWith('91') && cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }

  return cleaned;
}

/**
 * Validate phone number format
 * @param phone - Phone number to validate
 * @returns true if valid, false otherwise
 */
export function isValidPhoneNumber(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');

  // Should be at least 10 digits (local) or 12 digits (with country code)
  if (cleaned.length < 10) {
    return false;
  }

  // Should contain only digits
  return /^\d+$/.test(cleaned);
}

/**
 * Format phone number for display
 * @param phone - Phone number
 * @returns Formatted phone for display (e.g., "+91 98765 43210")
 */
export function formatPhoneDisplay(phone: string): string {
  const cleaned = formatPhoneForWhatsApp(phone);

  if (cleaned.startsWith('91') && cleaned.length === 12) {
    // Indian format: +91 XXXXX XXXXX
    return `+91 ${cleaned.substring(2, 7)} ${cleaned.substring(7)}`;
  }

  return `+${cleaned}`;
}
