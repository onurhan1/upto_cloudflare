export const runtime = 'edge';

'use client';

import { useEffect, useState } from 'react';

import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import MainLayout from '@/components/layout/MainLayout';
import { ArrowLeft, Play, Activity, Clock, AlertTriangle, CheckCircle, XCircle, Settings, BarChart3, FileText, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

export default function ServiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const serviceId = params.id as string;
  const [service, setService] = useState<any>(null);
  const [recentChecks, setRecentChecks] = useState<any[]>([]);
  const [openIncidents, setOpenIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Get current status from most recent check
  const currentStatus = recentChecks.length > 0 ? recentChecks[0].status : 'unknown';

  useEffect(() => {
    loadService();
    loadSuggestions();
  }, [serviceId]);

  const loadService = async () => {
    try {
      const result = await api.getService(serviceId);
      if (result.error) {
        setError(result.error);
        if (result.error.includes('Unauthorized')) {
          router.push('/login');
        }
      } else {
        setService(result.data?.service);
        setRecentChecks(result.data?.recentChecks || []);
        setOpenIncidents(result.data?.openIncidents || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load service');
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const result = await api.getServiceSuggestions(serviceId);
      if (result.error) {
        // Don't show error if OpenAI is not configured
        if (!result.error.includes('OpenAI')) {
          console.warn('Failed to load suggestions:', result.error);
        }
      } else {
        setAiSuggestions(result.data?.suggestions);
      }
    } catch (err: any) {
      console.warn('Error loading suggestions:', err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleTest = async () => {
    try {
      const result = await api.testService(serviceId);
      if (result.error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error,
        });
      } else {
        toast({
          title: 'Health check started',
          description: 'Checking service status...',
        });
        setTimeout(loadService, 2000);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to test service',
      });
    }
  };

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'up':
        return <CheckCircle className="text-green-400 h-5 w-5" />;
      case 'down':
        return <XCircle className="text-red-400 h-5 w-5" />;
      case 'degraded':
        return <AlertTriangle className="text-yellow-400 h-5 w-5" />;
      default:
        return <Activity className="text-muted-foreground h-5 w-5" />;
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error || !service) {
    return (
      <MainLayout>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-2">Service Not Found</h2>
            <p className="text-muted-foreground mb-4">{error || 'The service you are looking for does not exist'}</p>
            <Button asChild>
              <Link href="/services">Back to Services</Link>
            </Button>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <Button variant="ghost" asChild>
              <Link href="/services">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Services
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{service.name}</h1>
              <p className="text-muted-foreground font-mono">{service.url_or_host}</p>
            </div>
          </div>
          <Button onClick={handleTest}>
            <Play className="mr-2 h-4 w-4" />
            Test Now
          </Button>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Type</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{service.type.toUpperCase()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status</CardTitle>
              {getStatusIcon(currentStatus)}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currentStatus.toUpperCase()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monitoring</CardTitle>
              <Activity className={service.is_active ? 'text-green-400 h-4 w-4' : 'text-muted-foreground h-4 w-4'} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${service.is_active ? 'text-green-400' : 'text-muted-foreground'}`}>
                {service.is_active ? 'ENABLED' : 'DISABLED'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Check Interval</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{service.check_interval_seconds}s</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">
              <Activity className="mr-2 h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="uptime">
              <BarChart3 className="mr-2 h-4 w-4" />
              Uptime
            </TabsTrigger>
            <TabsTrigger value="logs">
              <FileText className="mr-2 h-4 w-4" />
              Logs
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            {/* Open Incidents */}
            {openIncidents.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Open Incidents</CardTitle>
                  <CardDescription>
                    Active incidents for this service
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {openIncidents.map((incident) => (
                      <Link
                        key={incident.id}
                        href={`/incidents/${incident.id}`}
                        className="block p-3 rounded-lg border hover:bg-accent transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{incident.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Started: {formatDistanceToNow(new Date(incident.started_at * 1000), { addSuffix: true })}
                            </p>
                          </div>
                          <Badge variant="destructive">{incident.status.toUpperCase()}</Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Health Checks */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Health Checks</CardTitle>
                <CardDescription>
                  Latest monitoring results
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Response Time</TableHead>
                        <TableHead>Status Code</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentChecks.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No health checks yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        recentChecks.map((check) => (
                          <TableRow key={check.id}>
                            <TableCell className="text-sm">
                              {formatDistanceToNow(new Date(check.checked_at * 1000), { addSuffix: true })}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(check.status)}
                            </TableCell>
                            <TableCell className="text-sm">
                              {check.response_time_ms ? `${check.response_time_ms}ms` : 'N/A'}
                            </TableCell>
                            <TableCell className="text-sm">
                              {check.status_code || 'N/A'}
                            </TableCell>
                            <TableCell className="text-sm text-destructive">
                              {check.error_message || '-'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Uptime Tab */}
          <TabsContent value="uptime" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Uptime Statistics</CardTitle>
                <CardDescription>
                  Service availability metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-center justify-center border-2 border-dashed rounded-lg">
                  <div className="text-center space-y-2">
                    <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto" />
                    <p className="text-sm text-muted-foreground">Uptime chart placeholder</p>
                    <p className="text-xs text-muted-foreground">
                      Chart visualization will be implemented here
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">24h Uptime</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">99.9%</div>
                  <p className="text-xs text-muted-foreground mt-1">Placeholder</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">7d Uptime</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">99.8%</div>
                  <p className="text-xs text-muted-foreground mt-1">Placeholder</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">30d Uptime</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">99.7%</div>
                  <p className="text-xs text-muted-foreground mt-1">Placeholder</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Health Check Logs</CardTitle>
                <CardDescription>
                  Complete history of health checks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Response Time</TableHead>
                        <TableHead>Status Code</TableHead>
                        <TableHead>Error Message</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentChecks.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No health checks yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        recentChecks.map((check) => (
                          <TableRow key={check.id}>
                            <TableCell className="text-sm font-mono">
                              {new Date(check.checked_at * 1000).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(check.status)}
                            </TableCell>
                            <TableCell className="text-sm">
                              {check.response_time_ms ? `${check.response_time_ms}ms` : 'N/A'}
                            </TableCell>
                            <TableCell className="text-sm">
                              {check.status_code || 'N/A'}
                            </TableCell>
                            <TableCell className="text-sm text-destructive max-w-xs truncate">
                              {check.error_message || '-'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            {/* AI Suggestions */}
            {aiSuggestions && (
              <Card className="border-primary/50 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    AI Suggestions
                  </CardTitle>
                  <CardDescription>
                    Intelligent recommendations for optimal monitoring
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm font-medium mb-1">Check Interval</p>
                      <p className="text-2xl font-bold">{aiSuggestions.checkInterval}s</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Current: {service.check_interval_seconds}s
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">Timeout</p>
                      <p className="text-2xl font-bold">{aiSuggestions.timeout}ms</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Current: {service.timeout_ms}ms
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">Retry Count</p>
                      <p className="text-2xl font-bold">{aiSuggestions.retryCount}</p>
                    </div>
                  </div>
                  {aiSuggestions.reasoning && (
                    <div className="pt-4 border-t">
                      <p className="text-sm font-medium mb-2">Reasoning</p>
                      <p className="text-sm text-muted-foreground">{aiSuggestions.reasoning}</p>
                    </div>
                  )}
                  {aiSuggestions.idealParameters && (
                    <div className="pt-4 border-t">
                      <p className="text-sm font-medium mb-2">Ideal Parameters</p>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        {aiSuggestions.idealParameters.expectedStatusCode && (
                          <p>Expected Status Code: {aiSuggestions.idealParameters.expectedStatusCode}</p>
                        )}
                        {aiSuggestions.idealParameters.expectedKeyword && (
                          <p>Expected Keyword: {aiSuggestions.idealParameters.expectedKeyword}</p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {loadingSuggestions && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Sparkles className="h-4 w-4 animate-pulse" />
                    <span className="text-sm">Loading AI suggestions...</span>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Service Settings</CardTitle>
                <CardDescription>
                  Configure monitoring parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium mb-1">Check Interval</p>
                    <p className="text-sm text-muted-foreground">{service.check_interval_seconds} seconds</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Timeout</p>
                    <p className="text-sm text-muted-foreground">{service.timeout_ms}ms</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Expected Status Code</p>
                    <p className="text-sm text-muted-foreground">{service.expected_status_code || 'Any'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Expected Keyword</p>
                    <p className="text-sm text-muted-foreground">{service.expected_keyword || 'None'}</p>
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <p className="text-sm font-medium mb-2">Notifications</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Telegram</span>
                      <Badge variant={service.notify_telegram ? 'default' : 'secondary'}>
                        {service.notify_telegram ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Email</span>
                      <Badge variant={service.notify_email ? 'default' : 'secondary'}>
                        {service.notify_email ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="pt-4">
                  <Button variant="outline" asChild>
                    <Link href={`/services/${service.id}/edit`}>Edit Service</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
