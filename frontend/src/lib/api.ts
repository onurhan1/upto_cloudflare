// API client for frontend

// Get API URL - safe for both SSR and client-side
function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    // Client-side: use environment variable or default
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
  }
  // Server-side: always use default (env vars are available in Next.js)
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
}

const API_URL = getApiUrl();

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    // Ensure baseUrl doesn't end with a slash
    this.baseUrl = baseUrl.replace(/\/$/, '');
    console.log('🔵 ApiClient initialized with baseUrl:', this.baseUrl);
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('token');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('token', token);
        console.log('Token saved to localStorage');
      } else {
        localStorage.removeItem('token');
        console.log('Token removed from localStorage');
      }
    }
  }

  getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token');
    }
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    // Ensure endpoint starts with a slash
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    // Ensure baseUrl doesn't end with a slash
    const cleanBaseUrl = this.baseUrl.replace(/\/$/, '');
    const url = `${cleanBaseUrl}${normalizedEndpoint}`;
    
    console.log('🔵 API Request:', options.method || 'GET', url);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // Always get the latest token from localStorage
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Add organization ID from localStorage if available
    // Only add for authenticated endpoints (not for /auth/* or /oauth/*)
    if (typeof window !== 'undefined' && !endpoint.startsWith('/auth/') && !endpoint.startsWith('/oauth/')) {
      const orgId = localStorage.getItem('currentOrganizationId');
      if (orgId && !headers['X-Organization-ID'] && !endpoint.includes('organization_id=')) {
        headers['X-Organization-ID'] = orgId;
      }
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        mode: 'cors', // Explicitly set CORS mode
        credentials: 'include', // Include credentials for CORS
      });

      console.log('🟢 Response status:', response.status, response.statusText);

      // Check if response is ok before trying to parse JSON
      if (!response.ok) {
        // Try to parse error message from response
        try {
          const errorData = await response.json();
          console.error('🔴 API error response:', errorData);
          return { error: errorData.error || `Request failed with status ${response.status}` };
        } catch (parseError) {
          console.error('🔴 Failed to parse error response:', parseError);
          return { error: `Request failed with status ${response.status}` };
        }
      }

      // Parse JSON response
      const data = await response.json();
      console.log('✅ API response received:', Object.keys(data));

      // Backend returns { token, user } directly, not wrapped in data
      // So we return the data as-is
      return { data: data as T };
    } catch (error: any) {
      console.error('🔴 API request error:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        url: url,
      });
      
      // Handle network errors, CORS errors, etc.
      if (error.message === 'Failed to fetch' || error.name === 'TypeError' || error.message?.includes('fetch')) {
        return { 
          error: `Cannot connect to server at ${url}. Please make sure the backend is running on http://localhost:8787. Check browser console for details.` 
        };
      }
      return { error: error.message || 'Network error' };
    }
  }

  // Auth
  async login(email: string, password: string) {
    return this.request<{ 
      token: string; 
      user: any; 
      organizations?: any[]; 
      defaultOrganizationId?: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(email: string, password: string, name: string) {
    return this.request<{ token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  }

  // Services
  async getServices(organizationId: string, projectId?: string) {
    const params = new URLSearchParams({ organization_id: organizationId });
    if (projectId) {
      params.append('project_id', projectId);
    }
    return this.request<{ services: any[] }>(`/services?${params.toString()}`);
  }

  async getService(id: string) {
    return this.request<any>(`/services/${id}`);
  }

  async getServiceSuggestions(id: string) {
    return this.request<{ suggestions: any }>(`/services/${id}/suggestions`);
  }

  async createService(service: any, organizationId: string) {
    return this.request<any>('/services', {
      method: 'POST',
      headers: {
        'X-Organization-ID': organizationId,
      },
      body: JSON.stringify({ ...service, organization_id: organizationId }),
    });
  }

  async updateService(id: string, updates: any) {
    return this.request<any>(`/services/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteService(id: string) {
    return this.request<{ message: string }>(`/services/${id}`, {
      method: 'DELETE',
    });
  }

  async testService(id: string) {
    return this.request<{ message: string }>(`/services/${id}/test`, {
      method: 'POST',
    });
  }

  // Incidents
  async getIncidents(params?: { service_id?: string; status?: string }) {
    const query = new URLSearchParams(params as any).toString();
    return this.request<{ incidents: any[] }>(`/incidents${query ? `?${query}` : ''}`);
  }

  async getIncident(id: string) {
    return this.request<any>(`/incidents/${id}`);
  }

  async createIncident(incident: any) {
    return this.request<any>('/incidents', {
      method: 'POST',
      body: JSON.stringify(incident),
    });
  }

  async updateIncident(id: string, updates: any) {
    return this.request<any>(`/incidents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async addIncidentUpdate(id: string, update: { message: string; status: string }) {
    // Use updateIncident endpoint to add update
    return this.request<any>(`/incidents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(update),
    });
  }

  async resolveIncident(id: string) {
    // Use updateIncident endpoint to resolve
    return this.request<any>(`/incidents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'resolved' }),
    });
  }

  // Status Pages
  async getStatusPages() {
    return this.request<{ pages: any[] }>('/status-page/mine');
  }

  async createStatusPage(page: any) {
    return this.request<any>('/status-page', {
      method: 'POST',
      body: JSON.stringify(page),
    });
  }

  async getStatusPage(id: string) {
    return this.request<any>(`/status-page/${id}`);
  }

  async updateStatusPage(id: string, updates: any) {
    return this.request<any>(`/status-page/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  // Integrations
  async getIntegrations() {
    return this.request<{ integration: any }>('/integrations');
  }

  async updateTelegramIntegration(data: any) {
    return this.request<any>('/integrations/telegram', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async updateEmailIntegration(data: any) {
    return this.request<any>('/integrations/email', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteStatusPage(id: string) {
    return this.request<{ message: string }>(`/status-page/${id}`, {
      method: 'DELETE',
    });
  }

  async addServiceToStatusPage(pageId: string, serviceId: string, displayOrder: number = 0) {
    return this.request<any>(`/status-page/${pageId}/services`, {
      method: 'POST',
      body: JSON.stringify({ service_id: serviceId, display_order: displayOrder }),
    });
  }

  async removeServiceFromStatusPage(pageId: string, serviceId: string) {
    return this.request<any>(`/status-page/${pageId}/services/${serviceId}`, {
      method: 'DELETE',
    });
  }

  // OAuth
  async getOAuthProviders() {
    return this.request<{ providers: string[] }>('/oauth/providers');
  }

  async handleOAuthCallback(provider: string, code: string, state: string) {
    return this.request<{ token: string; user: any }>(`/oauth/${provider}/callback`, {
      method: 'POST',
      body: JSON.stringify({ code, state }),
    });
  }

  async getCurrentUser(): Promise<ApiResponse<{ user: any }>> {
    return this.request<{ user: any }>('/users/me');
  }

  // Organizations
  async getOrganizations() {
    return this.request<{ organizations: any[] }>('/organizations');
  }

  async createOrganization(name: string, slug?: string) {
    return this.request<any>('/organizations', {
      method: 'POST',
      body: JSON.stringify({ name, slug }),
    });
  }

  async getOrganization(id: string) {
    return this.request<any>(`/organizations/${id}`);
  }

  async inviteToOrganization(orgId: string, email: string, role: string = 'member') {
    return this.request<any>(`/organizations/${orgId}/invite`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  }

  async getOrganizationInvitations(orgId: string) {
    return this.request<{ invitations: any[] }>(`/organizations/${orgId}/invitations`);
  }

  // Projects
  async getProjects(organizationId: string) {
    return this.request<{ projects: any[] }>(`/projects?organization_id=${organizationId}`);
  }

  async createProject(name: string, description: string | null, organizationId: string) {
    return this.request<any>('/projects', {
      method: 'POST',
      headers: {
        'X-Organization-ID': organizationId,
      },
      body: JSON.stringify({ name, description, organization_id: organizationId }),
    });
  }

  async getProject(id: string, organizationId: string) {
    return this.request<any>(`/projects/${id}?organization_id=${organizationId}`);
  }

  async updateProject(id: string, organizationId: string, updates: any) {
    return this.request<any>(`/projects/${id}`, {
      method: 'PATCH',
      headers: {
        'X-Organization-ID': organizationId,
      },
      body: JSON.stringify(updates),
    });
  }

  async deleteProject(id: string, organizationId: string) {
    return this.request<{ message: string }>(`/projects/${id}`, {
      method: 'DELETE',
      headers: {
        'X-Organization-ID': organizationId,
      },
    });
  }

  // Invitations
  async getInvitationDetails(token: string) {
    return this.request<any>(`/invitations/${token}`);
  }

  async acceptInvitation(token: string) {
    return this.request<any>(`/invitations/${token}/accept`, {
      method: 'POST',
    });
  }

  // API Keys
  async getApiKeys() {
    return this.request<{ apiKeys: any[] }>('/settings/api-keys');
  }

  async saveApiKey(provider: string, apiKey: string) {
    return this.request<{ success: boolean; message: string }>(`/settings/api-keys/${provider}`, {
      method: 'PUT',
      body: JSON.stringify({ apiKey }),
    });
  }

  async deleteApiKey(provider: string) {
    return this.request<{ success: boolean; message: string }>(`/settings/api-keys/${provider}`, {
      method: 'DELETE',
    });
  }

  // Profile update
  async updateProfile(name: string, email: string) {
    return this.request<{ success: boolean; message: string; user: any }>('/settings/profile', {
      method: 'PATCH',
      body: JSON.stringify({ name, email }),
    });
  }

  // Password change
  async changePassword(currentPassword: string, newPassword: string) {
    return this.request<{ success: boolean; message: string }>('/settings/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  // Audit logs
  async getAuditLogs(params?: {
    action?: string;
    resource_type?: string;
    user_id?: string;
    limit?: number;
    offset?: number;
    start_date?: number;
    end_date?: number;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.action) queryParams.append('action', params.action);
    if (params?.resource_type) queryParams.append('resource_type', params.resource_type);
    if (params?.user_id) queryParams.append('user_id', params.user_id);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.start_date) queryParams.append('start_date', params.start_date.toString());
    if (params?.end_date) queryParams.append('end_date', params.end_date.toString());

    return this.request<{ logs: any[]; pagination: any }>(`/audit?${queryParams.toString()}`);
  }
}

export const api = new ApiClient(API_URL);

