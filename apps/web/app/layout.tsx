import type { Metadata } from 'next';
import type React from 'react';
import { Shell } from '@/components/shell';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tiresias Content Engine',
  description: 'Automated basketball content production for Tiresias and AntiTiresias.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
