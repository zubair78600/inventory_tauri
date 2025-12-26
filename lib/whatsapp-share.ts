import { invoke } from '@tauri-apps/api/core';
import { tempDir } from '@tauri-apps/api/path';
import { writeFile } from '@tauri-apps/plugin-fs';
import { formatPhoneForWhatsApp } from './phone-utils';

/**
 * Save PDF to temp directory and open WhatsApp chat with file
 * @param pdfUrl - Blob URL of the PDF
 * @param fileName - Default filename for the PDF
 * @param phone - Customer phone number (optional)
 * @param onPhoneRequired - Callback when phone number is required, receives file path
 * @returns Promise that resolves when complete
 */
export async function shareInvoiceViaWhatsApp(
  pdfUrl: string,
  fileName: string,
  phone?: string | null,
  onPhoneRequired?: (filePath: string) => void
): Promise<void> {
  try {
    // Step 1: Auto-save PDF to temp directory first
    const tempDirPath = await tempDir();
    const timestamp = Date.now();
    const filePath = `${tempDirPath}${fileName.replace('.pdf', '')}_${timestamp}.pdf`;

    // Fetch blob and save to temp
    const response = await fetch(pdfUrl);
    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);

    await writeFile(filePath, uint8Array);

    // Step 2: Handle phone number
    if (!phone || phone.trim() === '') {
      // No phone available, trigger manual entry with file path
      if (onPhoneRequired) {
        onPhoneRequired(filePath);
      } else {
        throw new Error('Phone number is required to share via WhatsApp');
      }
      return;
    }

    // Step 3: Open WhatsApp with customer's phone and file
    const formattedPhone = formatPhoneForWhatsApp(phone);
    await invoke('open_whatsapp_with_file', {
      phone: formattedPhone,
      filePath: filePath
    });

  } catch (error) {
    console.error('Error sharing via WhatsApp:', error);
    throw error;
  }
}

/**
 * Open WhatsApp chat directly (without saving PDF)
 * Used when phone is manually entered after initial share attempt
 * @param phone - Customer phone number
 * @param filePath - Optional file path if PDF was already saved
 */
export async function openWhatsAppChat(phone: string, filePath?: string): Promise<void> {
  const formattedPhone = formatPhoneForWhatsApp(phone);
  await invoke('open_whatsapp_with_file', {
    phone: formattedPhone,
    filePath: filePath || null
  });
}
