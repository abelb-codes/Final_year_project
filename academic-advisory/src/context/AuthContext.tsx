import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { apiFetch, ensureCsrfCookie } from '../lib/api';
import { DashboardStats, User } from '../types';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  dashboardStats: DashboardStats | null;
  refreshDashboardStats: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshDashboardStats = async () => {
    if (!user || user.role === 'admin') {
      setDashboardStats(null);
      return;
    }

    try {
      const response = await apiFetch<{ stats: DashboardStats }>('/api/dashboard/');
      setDashboardStats(response.data.stats);
    } catch {
      setDashboardStats(null);
    }
  };

  const refreshSession = async () => {
    try {
      await ensureCsrfCookie();
      const response = await apiFetch<{ user: User; dashboard_stats: DashboardStats }>('/api/auth/me/');
      setUser(response.data.user);
      if (response.data.user.role === 'admin') {
        setDashboardStats(null);
      } else {
        setDashboardStats(response.data.dashboard_stats);
      }
    } catch {
      setUser(null);
      setDashboardStats(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshSession();
  }, []);

  const login = async (username: string, password: string) => {
    const response = await apiFetch<{ user: User; dashboard_stats: DashboardStats }>('/api/auth/login/', {
      method: 'POST',
      body: { username, password },
    });
    setUser(response.data.user);
    if (response.data.user.role === 'admin') {
      setDashboardStats(null);
    } else {
      setDashboardStats(response.data.dashboard_stats);
    }
  };

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout/', { method: 'POST', body: {} });
    } catch {
      // Keep the client state consistent even if the session already expired.
    } finally {
      setUser(null);
      setDashboardStats(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        refreshSession,
        dashboardStats,
        refreshDashboardStats,
        isAuthenticated: !!user,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
