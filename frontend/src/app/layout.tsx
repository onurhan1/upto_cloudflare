import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/toaster';
import { OrganizationProvider } from '@/contexts/OrganizationContext';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Upto - Uptime Monitoring & Incident Management',
  description: 'Cloudflare-powered uptime monitoring platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange={false}
        >
          <OrganizationProvider>
            {children}
            <Toaster />
          </OrganizationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

