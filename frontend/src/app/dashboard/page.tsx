'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useOrganization } from '@/contexts/OrganizationContext';
import MainLayout from '@/components/layout/MainLayout';
import { Server, AlertTriangle, CheckCircle, XCircle, Activity, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function DashboardPage() {
  const router = useRouter();
  const { currentOrganization, loading: orgLoading } = useOrganization();
  const [services, setServices] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentOrganization && !orgLoading) {
      loadData();
    } else if (!orgLoading && !currentOrganization) {
      setLoading(false);
      setError('Please select an organization');
    }
  }, [currentOrganization, orgLoading]);

  const loadData = async () => {
    if (!currentOrganization) {
      setLoading(false);
      return;
    }

    try {
      const [servicesRes, incidentsRes] = await Promise.all([
        api.getServices(currentOrganization.id),
        api.getIncidents(),
      ]);

      if (servicesRes.error) {
        setError(servicesRes.error);
        if (servicesRes.error.includes('Unauthorized')) {
          router.push('/login');
        }
        return;
      }

      if (incidentsRes.error) {
        console.error('Error loading incidents:', incidentsRes.error);
      }

      setServices(servicesRes.data?.services || []);
      setIncidents(incidentsRes.data?.incidents || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalServices = services.length;
  const activeServices = services.filter((s) => s.is_active).length;
  const upServices = services.filter((s) => s.currentStatus === 'up').length;
  const downServices = services.filter((s) => s.currentStatus === 'down').length;
  const openIncidents = incidents.filter((i) => i.status !== 'resolved').length;

  const metrics = [
    {
      label: 'Total Services',
      value: totalServices,
      icon: Server,
      description: 'All monitored services',
    },
    {
      label: 'Active Services',
      value: activeServices,
      icon: Activity,
      description: 'Currently monitoring',
    },
    {
      label: 'Operational',
      value: upServices,
      icon: CheckCircle,
      description: 'Services up',
    },
    {
      label: 'Down',
      value: downServices,
      icon: XCircle,
      description: 'Services down',
    },
    {
      label: 'Open Incidents',
      value: openIncidents,
      icon: AlertTriangle,
      description: 'Active incidents',
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'up':
        return <Badge className="bg-green-500/10 text-green-400 border-green-500/20">UP</Badge>;
      case 'down':
        return <Badge variant="destructive">DOWN</Badge>;
      case 'degraded':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20">DEGRADED</Badge>;
      default:
        return <Badge variant="secondary">UNKNOWN</Badge>;
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your monitoring infrastructure
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Organization Loading */}
        {orgLoading && (
          <Alert>
            <AlertDescription>Loading organization...</AlertDescription>
          </Alert>
        )}

        {/* No Organization Selected */}
        {!orgLoading && !currentOrganization && (
          <Alert variant="destructive">
            <AlertDescription>Please select an organization from the dropdown above.</AlertDescription>
          </Alert>
        )}

        {/* Metrics Grid */}
        {!orgLoading && currentOrganization && (
          <>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Card key={i}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-4 rounded" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-8 w-16 mb-1" />
                      <Skeleton className="h-3 w-32" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {metrics.map((metric) => {
                  const Icon = metric.icon;
                  return (
                    <Card key={metric.label}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                          {metric.label}
                        </CardTitle>
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{metric.value}</div>
                        <p className="text-xs text-muted-foreground">
                          {metric.description}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Services */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Services</CardTitle>
                <Link
                  href="/services"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  View all
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <CardDescription>
                Latest monitored services
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <Skeleton className="h-12 flex-1" />
                    </div>
                  ))}
                </div>
              ) : services.length === 0 ? (
                <div className="text-center py-8">
                  <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">No services yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {services.slice(0, 5).map((service) => (
                    <Link
                      key={service.id}
                      href={`/services/${service.id}`}
                      className="block p-3 rounded-lg border hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{service.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {service.type.toUpperCase()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(service.currentStatus || 'unknown')}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Incidents */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Incidents</CardTitle>
                <Link
                  href="/incidents"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  View all
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <CardDescription>
                Latest incident reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <Skeleton className="h-12 flex-1" />
                    </div>
                  ))}
                </div>
              ) : incidents.length === 0 ? (
                <div className="text-center py-8">
                  <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">No incidents</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {incidents.slice(0, 5).map((incident) => (
                    <Link
                      key={incident.id}
                      href={`/incidents/${incident.id}`}
                      className="block p-3 rounded-lg border hover:bg-accent transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{incident.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {incident.service_name} •{' '}
                            {new Date(incident.started_at * 1000).toLocaleString()}
                          </p>
                        </div>
                        <Badge
                          variant={
                            incident.status === 'resolved'
                              ? 'default'
                              : incident.status === 'monitoring'
                              ? 'outline'
                              : 'destructive'
                          }
                          className={
                            incident.status === 'resolved'
                              ? 'bg-green-500/10 text-green-400 border-green-500/20'
                              : incident.status === 'monitoring'
                              ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                              : ''
                          }
                        >
                          {incident.status.toUpperCase()}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
