import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, clearToken, getToken, setToken } from "../api/client";

export type User = {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string;
  email?: string | null;
  emailRemindersEnabled?: boolean;
  role: "USER" | "ADMIN";
  totalPoints?: number;
  hasAcceptedSimulatorTerms?: boolean;
};

type AuthContextType = {
  user: User | null;
  /** Tylko pierwsze sprawdzenie sesji przy starcie aplikacji */
  initializing: boolean;
  login: (nickname: string, password: string) => Promise<void>;
  register: (data: {
    firstName: string;
    lastName: string;
    nickname: string;
    email: string;
    password: string;
    inviteCode?: string;
  }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!getToken()) {
        if (!cancelled) setInitializing(false);
        return;
      }
      try {
        const me = await api<User>("/auth/me");
        if (!cancelled) setUser(me);
      } catch {
        clearToken();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setInitializing(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (nickname: string, password: string) => {
    const data = await api<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ nickname, password }),
    });
    setToken(data.token);
    setUser(data.user);
  }, []);

  const register = useCallback(
    async (input: {
      firstName: string;
      lastName: string;
      nickname: string;
      email: string;
      password: string;
      inviteCode?: string;
    }) => {
      const data = await api<{ token: string; user: User }>("/auth/register", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setToken(data.token);
      setUser(data.user);
    },
    []
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, initializing, login, register, logout }),
    [user, initializing, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth musi być wewnątrz AuthProvider");
  return ctx;
}
