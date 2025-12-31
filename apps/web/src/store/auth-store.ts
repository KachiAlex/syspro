import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthUser } from '@syspro/shared';
import { authService, LoginCredentials, RegisterData, ChangePasswordData } from '@/lib/auth';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  tenantId: string | null;
}

interface AuthActions {
  login: (credentials: LoginCredentials, tenantId: string) => Promise<void>;
  register: (data: RegisterData, tenantId: string) => Promise<void>;
  logout: () => Promise<void>;
  getProfile: () => Promise<void>;
  changePassword: (data: ChangePasswordData) => Promise<void>;
  setTenantId: (tenantId: string) => void;
  clearError: () => void;
  checkAuth: () => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      tenantId: null,

      // Actions
      login: async (credentials: LoginCredentials, tenantId: string) => {
        set({ isLoading: true, error: null });
        
        try {
          await authService.login(credentials, tenantId);
          const user = await authService.getProfile();
          
          set({
            user,
            isAuthenticated: true,
            tenantId,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Login failed',
          });
          throw error;
        }
      },

      register: async (data: RegisterData, tenantId: string) => {
        set({ isLoading: true, error: null });
        
        try {
          await authService.register(data, tenantId);
          const user = await authService.getProfile();
          
          set({
            user,
            isAuthenticated: true,
            tenantId,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Registration failed',
          });
          throw error;
        }
      },

      logout: async () => {
        set({ isLoading: true });
        
        try {
          await authService.logout();
        } catch (error) {
          console.warn('Logout error:', error);
        } finally {
          set({
            user: null,
            isAuthenticated: false,
            tenantId: null,
            isLoading: false,
            error: null,
          });
        }
      },

      getProfile: async () => {
        if (!authService.isAuthenticated()) {
          set({ isAuthenticated: false, user: null });
          return;
        }

        set({ isLoading: true, error: null });
        
        try {
          const user = await authService.getProfile();
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to get profile',
          });
        }
      },

      changePassword: async (data: ChangePasswordData) => {
        set({ isLoading: true, error: null });
        
        try {
          await authService.changePassword(data);
          set({ isLoading: false, error: null });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to change password',
          });
          throw error;
        }
      },

      setTenantId: (tenantId: string) => {
        authService.setTenantId(tenantId);
        set({ tenantId });
      },

      clearError: () => {
        set({ error: null });
      },

      checkAuth: () => {
        const isAuthenticated = authService.isAuthenticated();
        const tenantId = authService.getTenantId();
        
        if (isAuthenticated && tenantId) {
          // Get fresh profile data
          get().getProfile();
        } else {
          set({
            user: null,
            isAuthenticated: false,
            tenantId: null,
          });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        tenantId: state.tenantId,
        // Don't persist sensitive data like user info or tokens
        // Those are handled by the API client
      }),
    }
  )
);