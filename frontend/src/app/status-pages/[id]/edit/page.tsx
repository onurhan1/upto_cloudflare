export const runtime = 'edge';

'use client';

import { useEffect, useState } from 'react';

import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import MainLayout from '@/components/layout/MainLayout';
import { ArrowLeft, Plus } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';

export default function EditStatusPagePage() {
  const router = useRouter();
  const params = useParams();
  const { currentOrganization } = useOrganization();
  const pageId = params.id as string;
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    slug: '',
    is_public: false,
    theme: 'auto',
  });
  const [services, setServices] = useState<any[]>([]);
  const [pageServices, setPageServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, [pageId, currentOrganization]);

  const loadData = async () => {
    if (!currentOrganization) return;
    try {
      const [pageRes, servicesRes] = await Promise.all([
        api.getStatusPage(pageId),
        api.getServices(currentOrganization.id),
      ]);

      if (pageRes.error) {
        setError(pageRes.error);
        return;
      }

      if (servicesRes.error) {
        console.error('Error loading services:', servicesRes.error);
      }

      const page = pageRes.data?.page;
      if (page) {
        setFormData({
          title: page.title || '',
          description: page.description || '',
          slug: page.slug || '',
          is_public: page.is_public === 1 || page.is_public === true,
          theme: page.theme || 'auto',
        });
        setPageServices(pageRes.data?.services || []);
      }

      setServices(servicesRes.data?.services || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    }

    if (!formData.slug.trim()) {
      errors.slug = 'Slug is required';
    } else if (!/^[a-z0-9-]+$/.test(formData.slug)) {
      errors.slug = 'Slug can only contain lowercase letters, numbers, and hyphens';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setValidationErrors({});

    if (!validate()) {
      return;
    }

    setSaving(true);

    try {
      const result = await api.updateStatusPage(pageId, formData);

      if (result.error) {
        setError(result.error);
      } else {
        router.push('/status-pages');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddService = async (serviceId: string) => {
    try {
      const result = await api.addServiceToStatusPage(pageId, serviceId, pageServices.length);
      if (result.error) {
        setError(result.error);
      } else {
        loadData();
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRemoveService = async (serviceId: string) => {
    try {
      const result = await api.removeServiceFromStatusPage(pageId, serviceId);
      if (result.error) {
        setError(result.error);
      } else {
        loadData();
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400">Loading...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-3xl">
        <Link
          href="/status-pages"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft size={18} />
          Back to Status Pages
        </Link>

        <h1 className="text-2xl font-bold text-white mb-2">Edit Status Page</h1>
        <p className="text-gray-400 text-sm mb-6">Update your status page settings</p>

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className={`w-full px-3 py-2 bg-gray-800 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                validationErrors.title
                  ? 'border-red-500'
                  : 'border-gray-700'
              }`}
            />
            {validationErrors.title && (
              <p className="mt-1 text-sm text-red-400">{validationErrors.title}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Slug *
            </label>
            <input
              type="text"
              required
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
              placeholder="my-status-page"
              className={`w-full px-3 py-2 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                validationErrors.slug
                  ? 'border-red-500'
                  : 'border-gray-700'
              }`}
            />
            {validationErrors.slug && (
              <p className="mt-1 text-sm text-red-400">{validationErrors.slug}</p>
            )}
            <p className="mt-1 text-xs text-gray-400">
              Public URL: /s/{formData.slug || 'slug'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Theme
            </label>
            <select
              value={formData.theme}
              onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="auto">Auto</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.is_public}
                onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm text-gray-300">Make this status page public</span>
            </label>
          </div>

          <div className="border-t border-gray-800 pt-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              Services on this page
            </h3>
            {pageServices.length === 0 ? (
              <p className="text-gray-400 mb-4">No services added yet.</p>
            ) : (
              <div className="space-y-2 mb-4">
                {pageServices.map((service) => (
                  <div
                    key={service.id}
                    className="flex items-center justify-between p-3 bg-gray-800 rounded"
                  >
                    <span className="text-sm text-white">{service.name}</span>
                    <button
                      onClick={() => handleRemoveService(service.id)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Add Service
            </label>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleAddService(e.target.value);
                  e.target.value = '';
                }
              }}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
                <option value="">Select a service...</option>
                {services
                  .filter((s) => !pageServices.some((ps) => ps.id === s.id))
                  .map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <Link
              href="/status-pages"
              className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition border border-gray-700"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}

