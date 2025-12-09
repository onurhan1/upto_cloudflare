'use client';

import { User, Bell, Search, Settings, LogOut, Building2, Plus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useOrganization } from '@/contexts/OrganizationContext';
import ThemeToggle from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';

export default function Header() {
  const router = useRouter();
  const { organizations, currentOrganization, setCurrentOrganization, loading: orgLoading } = useOrganization();
  const [user, setUser] = useState<any>(null);
  const [notifications, setNotifications] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const result = await api.getCurrentUser();
    if (result.data?.user) {
      setUser(result.data.user);
    }
  };

  const handleLogout = () => {
    api.setToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('currentOrganizationId');
    }
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-30 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-full items-center justify-between px-4 lg:px-6">
        {/* Organization Selector */}
        <div className="flex items-center gap-2 min-w-[200px]">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          {orgLoading ? (
            <div className="h-9 w-32 bg-muted animate-pulse rounded-md" />
          ) : organizations.length === 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/organizations/new')}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              <span>Create Organization</span>
            </Button>
          ) : (
            <Select
              value={currentOrganization?.id || ''}
              onValueChange={(value) => {
                if (value === '__create__') {
                  router.push('/organizations/new');
                  return;
                }
                const org = organizations.find((o) => o.id === value);
                if (org) {
                  setCurrentOrganization(org);
                }
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select organization" />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{org.name}</span>
                      <Badge variant="outline" className="ml-2 text-xs">
                        {org.role}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
                <SelectItem value="__create__">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    <span>Create Organization</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Search */}
        <div className="relative hidden md:flex flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search services, incidents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-full"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {notifications > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              >
                {notifications > 9 ? '9+' : notifications}
              </Badge>
            )}
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
                  <User className="h-5 w-5 text-primary-foreground" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user?.name || 'User'}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email || ''}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
