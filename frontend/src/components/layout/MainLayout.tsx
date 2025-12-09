'use client';

import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import { api } from '@/lib/api';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const router = useRouter();

  const handleLogout = () => {
    api.setToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('currentOrganizationId');
      localStorage.removeItem('organizations');
    }
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar onLogout={handleLogout} />
      <div className="lg:pl-64">
        <Header />
        <main className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">{children}</main>
      </div>
    </div>
  );
}

