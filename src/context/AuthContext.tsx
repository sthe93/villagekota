import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  default_address: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  isDriver: boolean;
  postLoginPath: string;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    displayName?: string
  ) => Promise<{ error: Error | null }>;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getPostLoginPath(isAdmin: boolean, isDriver: boolean) {
  if (isAdmin) return "/admin";
  if (isDriver) return "/driver";
  return "/";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDriver, setIsDriver] = useState(false);
  const [loading, setLoading] = useState(true);

  const buildAuthRedirectUrl = useCallback((path = "/auth") => {
    if (Capacitor.isNativePlatform()) {
      const nativeScheme =
        import.meta.env.VITE_NATIVE_AUTH_SCHEME?.trim().replace("://", "") || "co.villagekota.app";
      const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
      return `${nativeScheme}://${normalizedPath}`;
    }

    const basePath = import.meta.env.BASE_URL === "/" ? "" : import.meta.env.BASE_URL.replace(/\/$/, "");
    return `${window.location.origin}${basePath}${path}`;
  }, []);

  const resetAuthState = useCallback(() => {
    setProfile(null);
    setIsAdmin(false);
    setIsDriver(false);
  }, []);

  const resolveUserState = useCallback(async (userId: string) => {
    const [profileResult, adminRoleResult, driverRoleResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle(),
      supabase
        .from("drivers")
        .select("id")
        .eq("auth_user_id", userId)
        .eq("is_active", true)
        .maybeSingle(),
    ]);

    setProfile((profileResult.data as Profile | null) ?? null);
    setIsAdmin(!!adminRoleResult.data);
    setIsDriver(!!driverRoleResult.data);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    await resolveUserState(user.id);
  }, [resolveUserState, user]);

  useEffect(() => {
    let isMounted = true;

    const applySession = async (nextSession: Session | null) => {
      if (!isMounted) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        resetAuthState();
        setLoading(false);
        return;
      }

      setLoading(true);
      await resolveUserState(nextSession.user.id);

      if (!isMounted) return;
      setLoading(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void applySession(nextSession);
    });

    void supabase.auth
      .getSession()
      .then(({ data: { session: nextSession } }) => {
        void applySession(nextSession);
      });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [resetAuthState, resolveUserState]);

  const signUp = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: buildAuthRedirectUrl(),
          data: { display_name: displayName || email.split("@")[0] },
        },
      });

      return { error: error as Error | null };
    },
    [buildAuthRedirectUrl]
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error: error as Error | null };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: buildAuthRedirectUrl("/auth"),
        queryParams: {
          access_type: "offline",
          prompt: "select_account",
        },
      },
    });

    return { error: error as Error | null };
  }, [buildAuthRedirectUrl]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    resetAuthState();
  }, [resetAuthState]);

  const postLoginPath = getPostLoginPath(isAdmin, isDriver);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      profile,
      isAdmin,
      isDriver,
      postLoginPath,
      loading,
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      refreshProfile,
    }),
    [
      user,
      session,
      profile,
      isAdmin,
      isDriver,
      postLoginPath,
      loading,
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      refreshProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}