'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Import API directly - Next.js will handle SSR
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log('Attempting login with:', email);
      const result = await api.login(email, password);
      console.log('Login result:', result);

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      // Backend returns { token, user, organizations, defaultOrganizationId }
      if (result.data?.token) {
        console.log('Token received, saving...');
        api.setToken(result.data.token);
        
        // Save organizations and default organization
        if (result.data?.organizations && result.data.organizations.length > 0) {
          if (typeof window !== 'undefined') {
            localStorage.setItem('organizations', JSON.stringify(result.data.organizations));
            if (result.data.defaultOrganizationId) {
              localStorage.setItem('currentOrganizationId', result.data.defaultOrganizationId);
            } else if (result.data.organizations[0]) {
              localStorage.setItem('currentOrganizationId', result.data.organizations[0].id);
            }
          }
        }
        
        // Verify token was saved
        const savedToken = api.getToken();
        console.log('Token saved:', savedToken ? 'Yes' : 'No');
        
        if (savedToken) {
          // Use window.location for a hard redirect to ensure auth state is updated
          window.location.href = '/dashboard';
        } else {
          setError('Failed to save token');
          setLoading(false);
        }
      } else if (result.error) {
        // Show the error message from backend
        setError(result.error);
        setLoading(false);
      } else {
        console.error('No token in response:', result);
        setError('Login failed: No token received');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'An error occurred');
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
    const frontendUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    window.location.href = `${apiUrl}/oauth/google?frontend_url=${encodeURIComponent(frontendUrl)}`;
  };

  const handleAppleLogin = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
    const frontendUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    window.location.href = `${apiUrl}/oauth/apple?frontend_url=${encodeURIComponent(frontendUrl)}`;
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#030712' }}>
      <div style={{ maxWidth: '28rem', width: '100%', padding: '2rem', backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: '0.5rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#ffffff', marginBottom: '0.5rem' }}>Upto</h1>
          <h2 style={{ fontSize: '1.125rem', color: '#9ca3af' }}>Security Monitoring Platform</h2>
        </div>
        
        <form onSubmit={handleSubmit} style={{ marginTop: '2rem' }}>
          {error && (
            <div style={{ padding: '0.75rem 1rem', borderRadius: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', marginBottom: '1rem' }}>
              {error}
            </div>
          )}
          
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="email" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#d1d5db', marginBottom: '0.5rem' }}>
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '0.5rem 0.75rem', 
                backgroundColor: '#1f2937', 
                border: '1px solid #374151', 
                borderRadius: '0.5rem', 
                color: '#ffffff',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              placeholder="you@example.com"
            />
          </div>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="password" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#d1d5db', marginBottom: '0.5rem' }}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '0.5rem 0.75rem', 
                backgroundColor: '#1f2937', 
                border: '1px solid #374151', 
                borderRadius: '0.5rem', 
                color: '#ffffff',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ 
              width: '100%', 
              padding: '0.5rem 1rem', 
              backgroundColor: loading ? '#4b5563' : '#2563eb', 
              color: '#ffffff', 
              borderRadius: '0.5rem', 
              fontWeight: '500',
              fontSize: '0.875rem',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1
            }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>

          <div style={{ position: 'relative', margin: '1.5rem 0' }}>
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: '1px solid #374151' }}></div>
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
              <span style={{ padding: '0 0.5rem', backgroundColor: '#111827', color: '#9ca3af', fontSize: '0.875rem' }}>Or continue with</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <button
              type="button"
              onClick={handleGoogleLogin}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                padding: '0.5rem 1rem', 
                backgroundColor: '#1f2937', 
                border: '1px solid #374151', 
                borderRadius: '0.5rem', 
                color: '#ffffff',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              <svg style={{ width: '1.25rem', height: '1.25rem', marginRight: '0.5rem' }} viewBox="0 0 24 24" fill="currentColor">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Google</span>
            </button>
            <button
              type="button"
              onClick={handleAppleLogin}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                padding: '0.5rem 1rem', 
                backgroundColor: '#1f2937', 
                border: '1px solid #374151', 
                borderRadius: '0.5rem', 
                color: '#ffffff',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              <svg style={{ width: '1.25rem', height: '1.25rem', marginRight: '0.5rem' }} fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              <span>Apple</span>
            </button>
          </div>

          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
              Don't have an account?{' '}
              <Link href="/register" style={{ color: '#60a5fa', fontWeight: '500', textDecoration: 'none' }}>
                Sign up
              </Link>
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
