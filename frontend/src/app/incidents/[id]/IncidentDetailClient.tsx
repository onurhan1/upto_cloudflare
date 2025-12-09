'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import MainLayout from '@/components/layout/MainLayout';
import { ArrowLeft, Clock, AlertTriangle, CheckCircle, MessageSquare, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

export default function IncidentDetailClient() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const incidentId = params.id as string;
  const [incident, setIncident] = useState<any>(null);
  const [updates, setUpdates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updateMessage, setUpdateMessage] = useState('');
  const [updateStatus, setUpdateStatus] = useState('investigating');

  useEffect(() => {
    loadIncident();
  }, [incidentId]);

  const loadIncident = async () => {
    try {
      const result = await api.getIncident(incidentId);
      if (result.error) {
        setError(result.error);
        if (result.error.includes('Unauthorized')) {
          router.push('/login');
        }
      } else {
        setIncident(result.data?.incident);
        setUpdates(result.data?.updates || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load incident');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUpdate = async () => {
    if (!updateMessage.trim()) {
      toast({
        title: 'Error',
        description: 'Update message is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await api.addIncidentUpdate(incidentId, {
        message: updateMessage,
        status: updateStatus as any,
      });

      if (result.error) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Success',
          description: 'Update added successfully',
        });
        setUpdateMessage('');
        loadIncident();
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to add update',
        variant: 'destructive',
      });
    }
  };

  const handleResolve = async () => {
    try {
      const result = await api.resolveIncident(incidentId);
      if (result.error) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Success',
          description: 'Incident resolved successfully',
        });
        loadIncident();
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to resolve incident',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <p className="text-red-500">{error}</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!incident) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <p>Incident not found</p>
        </div>
      </MainLayout>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge variant="destructive">Open</Badge>;
      case 'monitoring':
        return <Badge variant="default">Monitoring</Badge>;
      case 'resolved':
        return <Badge className="bg-green-500">Resolved</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getUpdateStatusBadge = (status: string) => {
    switch (status) {
      case 'investigating':
        return <Badge variant="default">Investigating</Badge>;
      case 'identified':
        return <Badge variant="default">Identified</Badge>;
      case 'monitoring':
        return <Badge variant="default">Monitoring</Badge>;
      case 'resolved':
        return <Badge className="bg-green-500">Resolved</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Link href="/incidents">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Incidents
            </Button>
          </Link>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">{incident.title}</h1>
              <div className="flex items-center gap-4">
                {getStatusBadge(incident.status)}
                <span className="text-sm text-gray-500">
                  Started {formatDistanceToNow(new Date(incident.started_at * 1000), { addSuffix: true })}
                </span>
              </div>
            </div>
            {incident.status !== 'resolved' && (
              <Button onClick={handleResolve} className="bg-green-500 hover:bg-green-600">
                <CheckCircle className="mr-2 h-4 w-4" />
                Resolve Incident
              </Button>
            )}
          </div>

          {incident.description && (
            <p className="text-gray-300 mb-4">{incident.description}</p>
          )}
        </div>

        <Tabs defaultValue="updates" className="w-full">
          <TabsList>
            <TabsTrigger value="updates">Updates</TabsTrigger>
            <TabsTrigger value="ai-summary">AI Summary</TabsTrigger>
          </TabsList>

          <TabsContent value="updates">
            <Card>
              <CardHeader>
                <CardTitle>Incident Updates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 mb-6">
                  {updates.map((update: any) => (
                    <div key={update.id} className="border-b border-gray-700 pb-4 last:border-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getUpdateStatusBadge(update.status)}
                          <span className="text-sm text-gray-500">
                            {formatDistanceToNow(new Date(update.created_at * 1000), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      <p className="text-gray-300">{update.message}</p>
                    </div>
                  ))}
                </div>

                {incident.status !== 'resolved' && (
                  <div className="border-t border-gray-700 pt-4">
                    <h3 className="text-lg font-semibold mb-4">Add Update</h3>
                    <div className="space-y-4">
                      <Textarea
                        placeholder="Update message..."
                        value={updateMessage}
                        onChange={(e) => setUpdateMessage(e.target.value)}
                        rows={4}
                      />
                      <Select value={updateStatus} onValueChange={setUpdateStatus}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="investigating">Investigating</SelectItem>
                          <SelectItem value="identified">Identified</SelectItem>
                          <SelectItem value="monitoring">Monitoring</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button onClick={handleAddUpdate}>Add Update</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai-summary">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  AI Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                {incident.ai_summary ? (
                  <div className="prose prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap text-sm">{incident.ai_summary}</pre>
                  </div>
                ) : (
                  <p className="text-gray-500">AI summary not available for this incident.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

