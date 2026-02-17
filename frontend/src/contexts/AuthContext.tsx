import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { API_BASE } from "@/lib/constants";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "OPERATOR";
  tenantId: string;
  isActive: boolean;
  createdAt: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  loginWithGoogleCode: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

let _accessToken: string | null = null;

/** Used by the API client to attach the Bearer token */
export function getAccessToken(): string | null {
  return _accessToken;
}

/** Called by the API client on 401 to try refreshing */
export async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      _accessToken = null;
      return null;
    }
    const data = await res.json();
    _accessToken = data.accessToken;
    return _accessToken;
  } catch {
    _accessToken = null;
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
    error: null,
  });

  // On mount, attempt to restore session via refresh token cookie
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) {
          if (!cancelled) {
            setState({ user: null, token: null, isLoading: false, error: null });
            _accessToken = null;
          }
          return;
        }
        const data = await res.json();
        _accessToken = data.accessToken;
        if (!cancelled) {
          setState({
            user: data.user,
            token: data.accessToken,
            isLoading: false,
            error: null,
          });
        }
      } catch {
        if (!cancelled) {
          setState({ user: null, token: null, isLoading: false, error: null });
          _accessToken = null;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, error: null, isLoading: true }));
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }
      _accessToken = data.accessToken;
      setState({
        user: data.user,
        token: data.accessToken,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      _accessToken = null;
      setState((s) => ({
        ...s,
        isLoading: false,
        error: err instanceof Error ? err.message : "Login failed",
      }));
      throw err;
    }
  }, []);

  const loginWithGoogle = useCallback(async (credential: string) => {
    setState((s) => ({ ...s, error: null, isLoading: true }));
    try {
      const res = await fetch(`${API_BASE}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ credential }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Google login failed");
      }
      _accessToken = data.accessToken;
      setState({
        user: data.user,
        token: data.accessToken,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      _accessToken = null;
      setState((s) => ({
        ...s,
        isLoading: false,
        error: err instanceof Error ? err.message : "Google login failed",
      }));
      throw err;
    }
  }, []);

  const loginWithGoogleCode = useCallback(async (code: string) => {
    setState((s) => ({ ...s, error: null, isLoading: true }));
    try {
      const res = await fetch(`${API_BASE}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Google login failed");
      }
      _accessToken = data.accessToken;
      setState({
        user: data.user,
        token: data.accessToken,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      _accessToken = null;
      setState((s) => ({
        ...s,
        isLoading: false,
        error: err instanceof Error ? err.message : "Google login failed",
      }));
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore
    }
    _accessToken = null;
    setState({ user: null, token: null, isLoading: false, error: null });
  }, []);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        loginWithGoogle,
        loginWithGoogleCode,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
