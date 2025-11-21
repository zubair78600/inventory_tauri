import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Plus_Jakarta_Sans, Playfair_Display } from 'next/font/google';
import Sidebar from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import './globals.css';
import { Providers } from '@/components/providers';

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
  // Auth will be implemented in Phase 10 - for now, desktop app runs in single-user mode
  const userEmail = 'User';
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${display.variable}`}>
      <body>
        <Providers>
          <div className="app-shell">
            <Sidebar />
            <div className="main">
              <Header userEmail={userEmail} />
              <div className="page-container">{children}</div>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
