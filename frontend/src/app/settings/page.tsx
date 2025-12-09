'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useOrganization } from '@/contexts/OrganizationContext';
import MainLayout from '@/components/layout/MainLayout';
import { User, Key, Bell, Shield, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications' | 'api-keys' | 'team'>('profile');

  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({});
  const [loadingApiKeys, setLoadingApiKeys] = useState(false);

  useEffect(() => {
    loadUser();
    if (activeTab === 'api-keys') {
      loadApiKeys();
    }
  }, [activeTab]);

  const loadUser = async () => {
    try {
      const result = await api.getCurrentUser();
      if (result.error) {
        setError(result.error);
        if (result.error.includes('Unauthorized')) {
          router.push('/login');
        }
      } else {
        const userData = result.data?.user;
        setUser(userData);
        setProfileData({
          name: userData?.name || '',
          email: userData?.email || '',
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const result = await api.updateProfile(profileData.name, profileData.email);
      
      if (result.error) {
        setError(result.error);
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        // Update local user state
        if (result.data?.user) {
          setUser(result.data.user);
          setProfileData({
            name: result.data.user.name,
            email: result.data.user.email,
          });
        }
        setError('');
        toast({
          title: 'Success',
          description: 'Profile updated successfully!',
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
      toast({
        title: 'Error',
        description: err.message || 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const loadApiKeys = async () => {
    setLoadingApiKeys(true);
    try {
      const result = await api.getApiKeys();
      if (result.error) {
        setError(result.error);
      } else {
        setApiKeys(result.data?.apiKeys || []);
        // Initialize input fields
        const inputs: Record<string, string> = {};
        (result.data?.apiKeys || []).forEach((key: any) => {
          inputs[key.provider] = ''; // Don't show existing keys for security
        });
        setApiKeyInputs(inputs);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingApiKeys(false);
    }
  };

  const handleSaveApiKey = async (provider: string) => {
    const apiKey = apiKeyInputs[provider]?.trim();
    if (!apiKey) {
      setError('API key is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const result = await api.saveApiKey(provider, apiKey);
      if (result.error) {
        setError(result.error);
      } else {
        // Clear input and reload
        setApiKeyInputs({ ...apiKeyInputs, [provider]: '' });
        await loadApiKeys();
        setError(''); // Clear any previous errors
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteApiKey = async (provider: string) => {
    if (!confirm(`Are you sure you want to delete the ${provider.toUpperCase()} API key?`)) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      const result = await api.deleteApiKey(provider);
      if (result.error) {
        setError(result.error);
      } else {
        await loadApiKeys();
        setError(''); // Clear any previous errors
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setSaving(true);

    try {
      const result = await api.changePassword(passwordData.currentPassword, passwordData.newPassword);
      
      if (result.error) {
        setError(result.error);
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        // Success - clear form and show success message
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        setError('');
        toast({
          title: 'Success',
          description: 'Password changed successfully!',
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Skeleton className="h-4 w-32" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage your account settings and preferences</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
          <TabsList>
            <TabsTrigger value="profile">
              <User className="mr-2 h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="security">
              <Shield className="mr-2 h-4 w-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="mr-2 h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="api-keys">
              <Key className="mr-2 h-4 w-4" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="team">
              <Users className="mr-2 h-4 w-4" />
              Team
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your profile information</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={profileData.name}
                      onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                      placeholder="Your name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                      placeholder="your@email.com"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={saving}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Update your password to keep your account secure</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current Password</Label>
                    <Input
                      id="current-password"
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                      placeholder="Enter current password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      placeholder="Enter new password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      placeholder="Confirm new password"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={saving}>
                      {saving ? 'Changing...' : 'Change Password'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Manage your notification settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Manage your notification settings. You can configure email and Telegram notifications in the{' '}
                  <a href="/integrations" className="text-primary hover:underline">
                    Integrations
                  </a>{' '}
                  page.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium">Email Notifications</h3>
                      <p className="text-sm text-muted-foreground">Receive incident alerts via email</p>
                    </div>
                    <Button variant="outline" asChild>
                      <a href="/integrations">Configure</a>
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium">Telegram Notifications</h3>
                      <p className="text-sm text-muted-foreground">Receive incident alerts via Telegram</p>
                    </div>
                    <Button variant="outline" asChild>
                      <a href="/integrations">Configure</a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="api-keys">
            <Card>
              <CardHeader>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>
                  Configure API keys for AI-powered features. Your keys are stored securely and only used for generating AI summaries and suggestions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingApiKeys ? (
                  <div className="space-y-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* OpenAI */}
                    <div className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">OpenAI</h3>
                          <p className="text-sm text-muted-foreground">Used for AI summaries and suggestions</p>
                        </div>
                        {apiKeys.find((k) => k.provider === 'openai' && k.isActive) && (
                          <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">Active</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          value={apiKeyInputs['openai'] || ''}
                          onChange={(e) => setApiKeyInputs({ ...apiKeyInputs, openai: e.target.value })}
                          placeholder={apiKeys.find((k) => k.provider === 'openai') ? 'Enter new key to update' : 'sk-...'}
                          className="flex-1"
                        />
                        {apiKeys.find((k) => k.provider === 'openai' && k.isActive) ? (
                          <>
                            <Button
                              onClick={() => handleSaveApiKey('openai')}
                              disabled={saving || !apiKeyInputs['openai']?.trim()}
                              variant="outline"
                            >
                              {saving ? 'Saving...' : 'Update'}
                            </Button>
                            <Button
                              onClick={() => handleDeleteApiKey('openai')}
                              disabled={saving}
                              variant="destructive"
                            >
                              Delete
                            </Button>
                          </>
                        ) : (
                          <Button
                            onClick={() => handleSaveApiKey('openai')}
                            disabled={saving || !apiKeyInputs['openai']?.trim()}
                          >
                            {saving ? 'Saving...' : 'Save'}
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Get your API key from{' '}
                        <a
                          href="https://platform.openai.com/api-keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          platform.openai.com/api-keys
                        </a>
                      </p>
                    </div>

                    {/* Placeholder for future providers */}
                    <div className="p-4 border rounded-lg opacity-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-sm">Anthropic (Coming Soon)</h3>
                          <p className="text-xs text-muted-foreground">Claude API support</p>
                        </div>
                        <span className="px-2 py-1 bg-muted text-muted-foreground text-xs rounded">Soon</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Team Tab */}
          <TabsContent value="team">
            <TeamManagementTab />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

// Team Management Component
function TeamManagementTab() {
  const { currentOrganization } = useOrganization();
  const { toast } = useToast();
  const [members, setMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin' | 'viewer'>('member');
  const [sendingInvite, setSendingInvite] = useState(false);

  useEffect(() => {
    if (currentOrganization) {
      loadTeamData();
    }
  }, [currentOrganization]);

  const loadTeamData = async () => {
    if (!currentOrganization) return;

    setLoading(true);
    try {
      // Load members
      const orgResult = await api.getOrganization(currentOrganization.id);
      if (orgResult.data?.organization?.members) {
        setMembers(orgResult.data.organization.members);
      }

      // Load invitations
      const invResult = await api.getOrganizationInvitations(currentOrganization.id);
      if (invResult.data?.invitations) {
        setInvitations(invResult.data.invitations.filter((inv: any) => !inv.accepted_at));
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Failed to load team data',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization || !inviteEmail.trim()) return;

    setSendingInvite(true);
    try {
      const result = await api.inviteToOrganization(
        currentOrganization.id,
        inviteEmail.trim(),
        inviteRole
      );

      if (result.error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error,
        });
      } else {
        toast({
          title: 'Success',
          description: `Invitation sent to ${inviteEmail}`,
        });
        setInviteEmail('');
        await loadTeamData();
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Failed to send invitation',
      });
    } finally {
      setSendingInvite(false);
    }
  };

  if (!currentOrganization) {
    return (
      <Alert>
        <AlertDescription>Please select an organization to manage team members.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Invite Member Card */}
      <Card>
        <CardHeader>
          <CardTitle>Invite Team Member</CardTitle>
          <CardDescription>Send an invitation to join {currentOrganization.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSendInvite} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="invite-email">Email Address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  required
                />
              </div>
              <div>
                <Label htmlFor="invite-role">Role</Label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            </div>
            <Button type="submit" disabled={sendingInvite || !inviteEmail.trim()}>
              {sendingInvite ? 'Sending...' : 'Send Invitation'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Members List */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>Members of {currentOrganization.name}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members yet</p>
          ) : (
            <div className="space-y-2">
              {members.map((member: any) => (
                <div
                  key={member.id || member.user_id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{member.user_name || member.email || 'Unknown'}</p>
                    <p className="text-sm text-muted-foreground">{member.email || member.user_email}</p>
                  </div>
                  <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                    {member.role}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
          <CardDescription>Invitations waiting for acceptance</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
            </div>
          ) : invitations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending invitations</p>
          ) : (
            <div className="space-y-2">
              {invitations.map((invitation: any) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{invitation.email}</p>
                    <p className="text-sm text-muted-foreground">
                      Invited {invitation.created_at
                        ? new Date(invitation.created_at * 1000).toLocaleDateString()
                        : 'recently'}
                    </p>
                  </div>
                  <Badge variant="outline">{invitation.role}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
