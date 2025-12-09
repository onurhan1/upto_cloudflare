'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import MainLayout from '@/components/layout/MainLayout';
import { Mail, MessageSquare, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';

export default function IntegrationsPage() {
  const router = useRouter();
  const [integration, setIntegration] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [telegramData, setTelegramData] = useState({
    telegram_chat_id: '',
    is_active: false,
  });

  const [emailData, setEmailData] = useState({
    email_address: '',
    is_active: false,
  });

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      const result = await api.getIntegrations();
      if (result.error) {
        setError(result.error);
        if (result.error.includes('Unauthorized')) {
          router.push('/login');
        }
      } else {
        const integrationData = result.data?.integration;
        setIntegration(integrationData);
        if (integrationData) {
          setTelegramData({
            telegram_chat_id: integrationData.telegram_chat_id || '',
            is_active: (integrationData.telegram_chat_id && (integrationData.is_active === 1 || integrationData.is_active === true)) || false,
          });
          setEmailData({
            email_address: integrationData.email_address || '',
            is_active: (integrationData.email_address && (integrationData.is_active === 1 || integrationData.is_active === true)) || false,
          });
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTelegram = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const result = await api.updateTelegramIntegration(telegramData);
      if (result.error) {
        setError(result.error);
      } else {
        alert('Telegram integration updated successfully');
        loadIntegrations();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const result = await api.updateEmailIntegration(emailData);
      if (result.error) {
        setError(result.error);
      } else {
        alert('Email integration updated successfully');
        loadIntegrations();
      }
    } catch (err: any) {
      setError(err.message);
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
          <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground">Configure your notification integrations</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Telegram Integration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-primary" />
              <CardTitle>Telegram Integration</CardTitle>
            </div>
            <CardDescription>
              Receive incident alerts via Telegram. Follow these steps:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside mb-6 space-y-1 text-sm text-muted-foreground">
              <li>Create a bot using @BotFather on Telegram and get your <strong className="text-foreground">Bot Token</strong></li>
              <li>Add the Bot Token to your backend environment variable <code className="bg-muted px-1 py-0.5 rounded text-xs">TELEGRAM_BOT_TOKEN</code></li>
              <li>Get your <strong className="text-foreground">Chat ID</strong> by messaging @userinfobot on Telegram</li>
              <li>Enter your Chat ID below and enable notifications</li>
            </ol>
            <form onSubmit={handleSaveTelegram} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="telegram-chat-id">Telegram Chat ID</Label>
                <Input
                  id="telegram-chat-id"
                  type="text"
                  value={telegramData.telegram_chat_id}
                  onChange={(e) => setTelegramData({ ...telegramData, telegram_chat_id: e.target.value })}
                  placeholder="123456789"
                />
                <p className="text-xs text-muted-foreground">
                  Get your Chat ID by messaging @userinfobot on Telegram
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="telegram-enabled"
                  checked={telegramData.is_active}
                  onCheckedChange={(checked) => setTelegramData({ ...telegramData, is_active: checked === true })}
                />
                <Label htmlFor="telegram-enabled" className="text-sm font-normal cursor-pointer">
                  Enable Telegram notifications
                </Label>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Telegram Settings'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Email Integration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-primary" />
              <CardTitle>Email Integration</CardTitle>
            </div>
            <CardDescription>
              Receive incident alerts via email. Make sure your MailChannels API key is configured in the backend.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveEmail} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-address">Email Address</Label>
                <Input
                  id="email-address"
                  type="email"
                  value={emailData.email_address}
                  onChange={(e) => setEmailData({ ...emailData, email_address: e.target.value })}
                  placeholder="your@email.com"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="email-enabled"
                  checked={emailData.is_active}
                  onCheckedChange={(checked) => setEmailData({ ...emailData, is_active: checked === true })}
                />
                <Label htmlFor="email-enabled" className="text-sm font-normal cursor-pointer">
                  Enable email notifications
                </Label>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Email Settings'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
