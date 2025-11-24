import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Plus_Jakarta_Sans, Playfair_Display } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { AuthProvider } from '@/contexts/AuthContext';
import AppShell from '@/components/layout/AppShell';

const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const display = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['600', '700'],
});

export const metadata: Metadata = {
  title: 'Inventory System',
  description: 'Desktop inventory management system built with Tauri',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${display.variable}`}>
      <body>
        <AuthProvider>
          <Providers>
            <AppShell>
              {children}
            </AppShell>
          </Providers>
        </AuthProvider>
      </body>
    </html>
  );
}
