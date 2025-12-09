import IncidentDetailClient from './IncidentDetailClient';

export default function IncidentDetailPage() {
  return <IncidentDetailClient />;
}
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

  const handleAddUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateMessage.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please enter an update message',
      });
      return;
    }

    try {
      const result = await api.updateIncident(incidentId, {
        message: updateMessage,
        status: updateStatus,
      });

      if (result.error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error,
        });
      } else {
        toast({
          title: 'Success',
          description: 'Update added successfully',
        });
        setUpdateMessage('');
        loadIncident();
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to add update',
      });
    }
  };

  const handleResolve = async () => {
    try {
      const result = await api.updateIncident(incidentId, {
        status: 'resolved',
        message: 'Incident resolved',
      });

      if (result.error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error,
        });
      } else {
        toast({
          title: 'Success',
          description: 'Incident resolved',
        });
        loadIncident();
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to resolve incident',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
        return <Badge className="bg-green-500/10 text-green-400 border-green-500/20">RESOLVED</Badge>;
      case 'monitoring':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20">MONITORING</Badge>;
      case 'open':
        return <Badge variant="destructive">OPEN</Badge>;
      default:
        return <Badge variant="secondary">{status.toUpperCase()}</Badge>;
    }
  };

  const parseAISummary = (summaryJson: string | null) => {
    if (!summaryJson) return null;
    try {
      return JSON.parse(summaryJson);
    } catch {
      return null;
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-32 w-full" />
        </div>
      </MainLayout>
    );
  }

  if (error || !incident) {
    return (
      <MainLayout>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-2">Incident Not Found</h2>
            <p className="text-muted-foreground mb-4">{error || 'The incident you are looking for does not exist'}</p>
            <Button asChild>
              <Link href="/incidents">Back to Incidents</Link>
            </Button>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  const aiSummary = parseAISummary(incident.ai_summary);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <Button variant="ghost" asChild>
              <Link href="/incidents">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Incidents
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{incident.title}</h1>
              <p className="text-muted-foreground">
                Service: {incident.service_name || 'N/A'}
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Started: {formatDistanceToNow(new Date(incident.started_at * 1000), { addSuffix: true })}</span>
              </div>
              {incident.resolved_at && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  <span>Resolved: {formatDistanceToNow(new Date(incident.resolved_at * 1000), { addSuffix: true })}</span>
                </div>
              )}
            </div>
          </div>
          {getStatusBadge(incident.status)}
        </div>

        {/* Description */}
        {incident.description && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm">{incident.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="timeline" className="space-y-4">
          <TabsList>
            <TabsTrigger value="timeline">
              <Clock className="mr-2 h-4 w-4" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="ai-summary">
              <Sparkles className="mr-2 h-4 w-4" />
              AI Summary
            </TabsTrigger>
            {incident.status !== 'resolved' && (
              <TabsTrigger value="update">
                <MessageSquare className="mr-2 h-4 w-4" />
                Add Update
              </TabsTrigger>
            )}
          </TabsList>

          {/* Timeline Tab */}
          <TabsContent value="timeline" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
                <CardDescription>Incident updates and status changes</CardDescription>
              </CardHeader>
              <CardContent>
                {updates.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No updates yet.</p>
                ) : (
                  <div className="space-y-4">
                    {updates.map((update) => (
                      <div key={update.id} className="border-l-2 border-primary pl-4 py-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="text-sm">{update.message}</p>
                            <div className="mt-2">
                              {getStatusBadge(update.status)}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground ml-4">
                            {formatDistanceToNow(new Date(update.created_at * 1000), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Summary Tab */}
          <TabsContent value="ai-summary" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  AI-Generated Summary
                </CardTitle>
                <CardDescription>
                  Intelligent analysis of this incident
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {aiSummary ? (
                  <>
                    {aiSummary.summary && (
                      <div>
                        <h3 className="text-sm font-semibold mb-2">Summary</h3>
                        <p className="text-sm text-muted-foreground">{aiSummary.summary}</p>
                      </div>
                    )}

                    {aiSummary.rootCause && (
                      <div>
                        <h3 className="text-sm font-semibold mb-2">Root Cause</h3>
                        <p className="text-sm text-muted-foreground">{aiSummary.rootCause}</p>
                      </div>
                    )}

                    {aiSummary.affectedSystems && aiSummary.affectedSystems.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold mb-2">Affected Systems</h3>
                        <ul className="list-disc list-inside space-y-1">
                          {aiSummary.affectedSystems.map((system: string, idx: number) => (
                            <li key={idx} className="text-sm text-muted-foreground">{system}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {aiSummary.recommendedActions && aiSummary.recommendedActions.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold mb-2">Recommended Actions</h3>
                        <ul className="list-disc list-inside space-y-1">
                          {aiSummary.recommendedActions.map((action: string, idx: number) => (
                            <li key={idx} className="text-sm text-muted-foreground">{action}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8">
                    <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-sm text-muted-foreground mb-2">
                      AI Summary not available
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {incident.ai_summary 
                        ? 'Failed to parse AI summary. It may be in an unexpected format.'
                        : 'AI summary has not been generated yet. It will be created automatically when the incident is analyzed.'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Add Update Tab */}
          {incident.status !== 'resolved' && (
            <TabsContent value="update" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Add Update</CardTitle>
                  <CardDescription>Provide an update on this incident</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddUpdate} className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Status</label>
                      <Select value={updateStatus} onValueChange={setUpdateStatus}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="investigating">Investigating</SelectItem>
                          <SelectItem value="identified">Identified</SelectItem>
                          <SelectItem value="monitoring">Monitoring</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Message</label>
                      <Textarea
                        value={updateMessage}
                        onChange={(e) => setUpdateMessage(e.target.value)}
                        rows={4}
                        placeholder="Update message..."
                      />
                    </div>
                    <div className="flex gap-4">
                      <Button type="submit">Add Update</Button>
                      {updateStatus === 'resolved' && (
                        <Button type="button" variant="outline" onClick={handleResolve}>
                          Resolve Incident
                        </Button>
                      )}
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </MainLayout>
  );
}
