'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useOrganization } from '@/contexts/OrganizationContext';
import MainLayout from '@/components/layout/MainLayout';
import { Activity, Filter, Calendar, User, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDistanceToNow } from 'date-fns';

const ACTION_COLORS: Record<string, string> = {
  'user.login': 'bg-blue-500/20 text-blue-400',
  'service.create': 'bg-green-500/20 text-green-400',
  'service.update': 'bg-yellow-500/20 text-yellow-400',
  'service.delete': 'bg-red-500/20 text-red-400',
  'incident.create': 'bg-orange-500/20 text-orange-400',
  'incident.update': 'bg-yellow-500/20 text-yellow-400',
  'incident.resolve': 'bg-green-500/20 text-green-400',
  'status_page.create': 'bg-purple-500/20 text-purple-400',
  'status_page.update': 'bg-purple-500/20 text-purple-400',
  'integration.update': 'bg-cyan-500/20 text-cyan-400',
};

const ACTION_LABELS: Record<string, string> = {
  'user.login': 'User Login',
  'service.create': 'Service Created',
  'service.update': 'Service Updated',
  'service.delete': 'Service Deleted',
  'incident.create': 'Incident Created',
  'incident.update': 'Incident Updated',
  'incident.resolve': 'Incident Resolved',
  'status_page.create': 'Status Page Created',
  'status_page.update': 'Status Page Updated',
  'integration.update': 'Integration Updated',
};

export default function ActivityPage() {
  const router = useRouter();
  const { currentOrganization, loading: orgLoading } = useOrganization();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    action: undefined as string | undefined,
    resource_type: undefined as string | undefined,
    search: '',
  });
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    has_more: false,
  });

  useEffect(() => {
    if (currentOrganization && !orgLoading) {
      loadLogs();
    } else if (!orgLoading && !currentOrganization) {
      setLoading(false);
      setError('Please select an organization');
    }
  }, [currentOrganization, orgLoading, filters.action, filters.resource_type]);

  const loadLogs = async () => {
    if (!currentOrganization) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await api.getAuditLogs({
        action: filters.action,
        resource_type: filters.resource_type,
        limit: pagination.limit,
        offset: pagination.offset,
      });

      if (result.error) {
        setError(result.error);
        if (result.error.includes('Unauthorized')) {
          router.push('/login');
        }
      } else {
        setLogs(result.data?.logs || []);
        setPagination(result.data?.pagination || pagination);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        log.action?.toLowerCase().includes(searchLower) ||
        log.user_name?.toLowerCase().includes(searchLower) ||
        log.user_email?.toLowerCase().includes(searchLower) ||
        log.metadata?.name?.toLowerCase().includes(searchLower) ||
        log.metadata?.title?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const getActionLabel = (action: string) => {
    return ACTION_LABELS[action] || action.replace(/\./g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getActionColor = (action: string) => {
    return ACTION_COLORS[action] || 'bg-gray-500/20 text-gray-400';
  };

  if (orgLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Skeleton className="h-4 w-32" />
        </div>
      </MainLayout>
    );
  }

  if (!currentOrganization) {
    return (
      <MainLayout>
        <Alert variant="destructive">
          <AlertDescription>Please select an organization from the dropdown above.</AlertDescription>
        </Alert>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Activity Timeline</h1>
            <p className="text-muted-foreground">
              View all activities and changes in your organization
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search activities..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-9"
                />
              </div>
              <Select 
                value={filters.action || undefined} 
                onValueChange={(value) => setFilters({ ...filters, action: value === 'all' ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="user.login">User Login</SelectItem>
                  <SelectItem value="service.create">Service Created</SelectItem>
                  <SelectItem value="service.update">Service Updated</SelectItem>
                  <SelectItem value="service.delete">Service Deleted</SelectItem>
                  <SelectItem value="incident.create">Incident Created</SelectItem>
                  <SelectItem value="incident.update">Incident Updated</SelectItem>
                  <SelectItem value="incident.resolve">Incident Resolved</SelectItem>
                  <SelectItem value="status_page.create">Status Page Created</SelectItem>
                  <SelectItem value="status_page.update">Status Page Updated</SelectItem>
                  <SelectItem value="integration.update">Integration Updated</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={filters.resource_type || undefined}
                onValueChange={(value) => setFilters({ ...filters, resource_type: value === 'all' ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Resources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Resources</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                  <SelectItem value="incident">Incident</SelectItem>
                  <SelectItem value="status_page">Status Page</SelectItem>
                  <SelectItem value="integration">Integration</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={loadLogs}>
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Timeline */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredLogs.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No activity yet</h3>
                <p className="text-sm text-muted-foreground">
                  Activity logs will appear here as you use the platform
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border" />

            <div className="space-y-6">
              {filteredLogs.map((log, index) => (
                <div key={log.id} className="relative flex gap-4">
                  {/* Timeline dot */}
                  <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background border-2 border-primary">
                    <Activity className="h-4 w-4 text-primary" />
                  </div>

                  {/* Content */}
                  <Card className="flex-1">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={getActionColor(log.action)}>
                              {getActionLabel(log.action)}
                            </Badge>
                            {log.resource_type && (
                              <Badge variant="outline">{log.resource_type}</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {log.metadata?.name || log.metadata?.title || 'Activity'}
                            {log.metadata?.type && ` (${log.metadata.type})`}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {log.user_name && (
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {log.user_name}
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDistanceToNow(new Date(log.created_at * 1000), { addSuffix: true })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pagination */}
        {pagination.has_more && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => {
                setPagination({ ...pagination, offset: pagination.offset + pagination.limit });
                loadLogs();
              }}
            >
              Load More
            </Button>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

