'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
  created_at: number;
}

interface OrganizationContextType {
  organizations: Organization[];
  currentOrganization: Organization | null;
  setCurrentOrganization: (org: Organization | null) => void;
  loading: boolean;
  refreshOrganizations: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrganization, setCurrentOrganizationState] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const loadOrganizations = async () => {
    try {
      const result = await api.getOrganizations();
      if (result.error) {
        console.error('Error loading organizations:', result.error);
        setOrganizations([]);
        setCurrentOrganizationState(null);
        setLoading(false);
        return;
      }

      const orgs = result.data?.organizations || [];
      setOrganizations(orgs);
      
      // Load current organization from localStorage or use first one
      if (typeof window !== 'undefined') {
        if (orgs.length === 0) {
          // No organizations - clear state
          setCurrentOrganizationState(null);
          localStorage.removeItem('currentOrganizationId');
        } else {
          const savedOrgId = localStorage.getItem('currentOrganizationId');
          const savedOrg = orgs.find((org: Organization) => org.id === savedOrgId);
          const selectedOrg = savedOrg || orgs[0];
          setCurrentOrganizationState(selectedOrg);
          localStorage.setItem('currentOrganizationId', selectedOrg.id);
        }
      }
    } catch (error) {
      console.error('Error loading organizations:', error);
      setOrganizations([]);
      setCurrentOrganizationState(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only load organizations if user is authenticated (has token)
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        loadOrganizations();
      } else {
        setLoading(false);
      }
    }
  }, []);

  const setCurrentOrganization = (org: Organization | null) => {
    setCurrentOrganizationState(org);
    if (typeof window !== 'undefined') {
      if (org) {
        localStorage.setItem('currentOrganizationId', org.id);
      } else {
        localStorage.removeItem('currentOrganizationId');
      }
    }
    // Reload page to update all components with new organization context
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        currentOrganization,
        setCurrentOrganization,
        loading,
        refreshOrganizations: loadOrganizations,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}

