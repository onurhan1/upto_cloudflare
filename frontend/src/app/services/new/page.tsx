'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import MainLayout from '@/components/layout/MainLayout';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const serviceFormSchema = z.object({
  name: z.string().min(1, 'Service name is required').max(100, 'Name must be less than 100 characters'),
  type: z.enum(['http', 'api', 'ping', 'dns', 'ssl', 'domain']),
  url_or_host: z.string().min(1, 'URL or host is required').refine(
    (val) => {
      // Allow URLs starting with http/https or valid hostnames
      return /^https?:\/\/.+\..+|^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}/.test(val);
    },
    { message: 'Please enter a valid URL or hostname' }
  ),
  port: z.string().optional(),
  check_interval_seconds: z.number().min(10, 'Check interval must be at least 10 seconds').max(86400, 'Check interval cannot exceed 24 hours'),
  timeout_ms: z.number().min(1000, 'Timeout must be at least 1000ms').max(60000, 'Timeout cannot exceed 60 seconds'),
  expected_status_code: z.string().optional().refine(
    (val) => {
      if (!val) return true;
      const num = parseInt(val);
      return num >= 100 && num <= 599;
    },
    { message: 'Status code must be between 100 and 599' }
  ),
  expected_keyword: z.string().optional(),
  notify_telegram: z.boolean(),
  notify_email: z.boolean(),
});

type ServiceFormValues = z.infer<typeof serviceFormSchema>;

export default function NewServicePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentOrganization } = useOrganization();

  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: {
      name: '',
      type: 'http',
      url_or_host: '',
      port: '',
      check_interval_seconds: 60,
      timeout_ms: 5000,
      expected_status_code: '',
      expected_keyword: '',
      notify_telegram: false,
      notify_email: false,
    },
  });

  const onSubmit = async (data: ServiceFormValues) => {
    if (!currentOrganization) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select an organization first',
      });
      return;
    }

    try {
      const serviceData = {
        ...data,
        port: data.port ? parseInt(data.port) : null,
        expected_status_code: data.expected_status_code
          ? parseInt(data.expected_status_code)
          : null,
        expected_keyword: data.expected_keyword || null,
      };

      const result = await api.createService(serviceData, currentOrganization.id);

      if (result.error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error,
        });
      } else {
        toast({
          title: 'Success',
          description: 'Service created successfully',
        });
        router.push('/services');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to create service',
      });
    }
  };

  return (
    <MainLayout>
      <div className="max-w-3xl space-y-6">
        <div>
          <Button variant="ghost" asChild>
            <Link href="/services">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Services
            </Link>
          </Button>
        </div>

        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Service</h1>
          <p className="text-muted-foreground">
            Add a new service to monitor
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Service Details</CardTitle>
            <CardDescription>
              Configure monitoring settings for your service
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Name</FormLabel>
                      <FormControl>
                        <Input placeholder="My Service" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="http">HTTP</SelectItem>
                          <SelectItem value="api">API</SelectItem>
                          <SelectItem value="ping">Ping</SelectItem>
                          <SelectItem value="dns">DNS</SelectItem>
                          <SelectItem value="ssl">SSL</SelectItem>
                          <SelectItem value="domain">Domain</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="url_or_host"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL or Host</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com or example.com" {...field} />
                      </FormControl>
                      <FormDescription>
                        Enter a full URL (with http/https) or a hostname
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="port"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Port (optional)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="80, 443, etc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="check_interval_seconds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Check Interval (seconds)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="10"
                            max="86400"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 60)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="timeout_ms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Timeout (ms)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1000"
                            max="60000"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 5000)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="expected_status_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expected Status Code (optional)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="200" {...field} />
                      </FormControl>
                      <FormDescription>
                        If left empty: 2xx/3xx = UP, 4xx = DEGRADED, 5xx = DOWN, Network error = DOWN
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expected_keyword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expected Keyword (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Expected text in response" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="notify_telegram"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Notify via Telegram</FormLabel>
                          <FormDescription>
                            Receive notifications when service status changes
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notify_email"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Notify via Email</FormLabel>
                          <FormDescription>
                            Receive email notifications when service status changes
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex gap-4">
                  <Button type="submit" disabled={form.formState.isSubmitting} className="flex-1">
                    {form.formState.isSubmitting ? 'Creating...' : 'Create Service'}
                  </Button>
                  <Button type="button" variant="outline" asChild>
                    <Link href="/services">Cancel</Link>
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
