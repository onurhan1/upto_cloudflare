'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, XCircle, AlertTriangle, Activity, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';


export default function PublicStatusPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStatusPage();
  }, [slug]);

  const loadStatusPage = async () => {
    try {
      const response = await fetch(`${API_URL}/public/status/${slug}`);
      if (!response.ok) {
        setError('Status page not found');
        return;
      }
      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'up':
        return <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">Operational</Badge>;
      case 'down':
        return <Badge variant="destructive">Down</Badge>;
      case 'degraded':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20">Degraded</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'up':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'down':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Activity className="h-5 w-5 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-4xl w-full space-y-6">
          <Skeleton className="h-12 w-64 mx-auto" />
          <Skeleton className="h-6 w-96 mx-auto" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Status Page Not Found</CardTitle>
            <CardDescription>{error || 'The status page you are looking for does not exist'}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            {data.page.title}
          </h1>
          {data.page.description && (
            <p className="text-lg text-muted-foreground">
              {data.page.description}
            </p>
          )}
        </div>

        {/* Services */}
        <div className="space-y-6 mb-12">
          <h2 className="text-2xl font-semibold">Services</h2>
          {data.services.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">No services configured.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {data.services.map((service: any) => {
                const status = service.status?.current || 'unknown';
                return (
                  <Card key={service.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            {getStatusIcon(status)}
                            <h3 className="text-lg font-semibold">
                              {service.name}
                            </h3>
                          </div>
                          <p className="text-sm text-muted-foreground font-mono">
                            {service.url_or_host}
                          </p>
                          {service.status?.responseTime && (
                            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                              <Clock className="h-4 w-4" />
                              <span>Response time: {service.status.responseTime}ms</span>
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          {getStatusBadge(status)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Incidents */}
        {data.incidents.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">Incidents</h2>
            <div className="space-y-4">
              {data.incidents.map((incident: any) => (
                <Card key={incident.id} className="border-destructive/50 bg-destructive/5">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-destructive mb-2">
                          {incident.title}
                        </CardTitle>
                        <CardDescription className="mb-2">
                          {incident.service_name}
                        </CardDescription>
                        {incident.description && (
                          <p className="text-sm text-muted-foreground mt-2">
                            {incident.description}
                          </p>
                        )}
                      </div>
                      <Badge variant="destructive">
                        {incident.status.toUpperCase()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Started: {formatDistanceToNow(new Date(incident.started_at * 1000), { addSuffix: true })}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            Last updated: {formatDistanceToNow(new Date(data.updatedAt), { addSuffix: true })}
          </p>
        </div>
      </div>
    </div>
  );
}
