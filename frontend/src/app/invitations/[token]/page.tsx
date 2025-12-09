'use client';

export const runtime = 'edge';

import { useEffect, useState } from 'react';

import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function InvitationAcceptPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const token = params.token as string;
  const [invitation, setInvitation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (token) {
      loadInvitation();
    }
  }, [token]);

  const loadInvitation = async () => {
    try {
      const result = await api.getInvitationDetails(token);
      if (result.error) {
        setError(result.error);
      } else {
        setInvitation(result.data?.invitation);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
      toast({
        variant: 'destructive',
        title: 'Login Required',
        description: 'Please log in to accept this invitation',
      });
      router.push(`/login?redirect=/invitations/${params.token}`);
      return;
    }

    setAccepting(true);
    try {
      const result = await api.acceptInvitation(token);
      if (result.error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error,
        });
      } else {
        toast({
          title: 'Success',
          description: 'Invitation accepted! Redirecting...',
        });
        // Reload organizations and redirect to dashboard
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1500);
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Failed to accept invitation',
      });
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardContent className="pt-6">
              <Skeleton className="h-8 w-64 mb-4" />
              <Skeleton className="h-4 w-96 mb-8" />
              <Skeleton className="h-10 w-32" />
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  if (error || !invitation) {
    return (
      <MainLayout>
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                Invalid Invitation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive">
                <AlertDescription>
                  {error || 'This invitation is invalid or has expired. Please contact the organization administrator for a new invitation.'}
                </AlertDescription>
              </Alert>
              <div className="mt-4">
                <Button onClick={() => router.push('/login')}>Go to Login</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Organization Invitation
            </CardTitle>
            <CardDescription>
              You've been invited to join an organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Organization</p>
              <p className="text-lg font-semibold">{invitation.organization?.name || 'Unknown'}</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Email</p>
              <p className="text-muted-foreground">{invitation.email}</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Role</p>
              <Badge variant="secondary">{invitation.role}</Badge>
            </div>

            {invitation.expiresAt && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Expires</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(invitation.expiresAt * 1000).toLocaleDateString()}
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button onClick={handleAccept} disabled={accepting} className="flex-1">
                {accepting ? 'Accepting...' : 'Accept Invitation'}
              </Button>
              <Button variant="outline" onClick={() => router.push('/login')}>
                Cancel
              </Button>
            </div>

            {!localStorage.getItem('token') && (
              <Alert>
                <AlertDescription>
                  You need to be logged in to accept this invitation. Click "Accept Invitation" to log in first.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

