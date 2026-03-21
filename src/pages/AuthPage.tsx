import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";

export default function AuthPage() {
  const [submitting, setSubmitting] = useState(false);
  const { signIn, signInWithGoogle, signUp, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const handledGoogleRedirect = useRef(false);

  const redirectAfterLogin = async (userId: string, successMessage = "Welcome back!") => {
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    toast.success(successMessage);

    if (adminRole) {
      navigate("/admin");
      return;
    }

    const { data: driverProfile } = await supabase
      .from("drivers")
      .select("id")
      .eq("auth_user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (driverProfile) {
      navigate("/driver");
      return;
    }

    navigate("/");
  };

  useEffect(() => {
    const provider = new URLSearchParams(location.search).get("provider");

    if (provider !== "google" || loading || !user || handledGoogleRedirect.current) {
      return;
    }

    handledGoogleRedirect.current = true;
    void redirectAfterLogin(user.id, "Signed in with Google");
  }, [loading, location.search, navigate, user]);

  const redirectAfterLogin = async (userId: string, successMessage = "Welcome back!") => {
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    toast.success(successMessage);

    if (adminRole) {
      navigate("/admin");
      return;
    }

    const { data: driverProfile } = await supabase
      .from("drivers")
      .select("id")
      .eq("auth_user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (driverProfile) {
      navigate("/driver");
      return;
    }

    navigate("/");
  };

        await redirectAfterLogin(user.id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setSubmitting(true);

    try {
      const { error } = await signInWithGoogle();
      if (error) throw error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to continue with Google");
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="font-display text-5xl text-foreground mb-2">WELCOME</h1>
            <p className="text-muted-foreground font-body text-sm">
              {isSignUp ? "Join Village Kota and start ordering" : "Sign in to your account"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="bg-card rounded-lg border border-border p-6 space-y-4">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={submitting}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z"
                    fill="#4285F4"
                  />
                  <path
                    d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.82.86-3.06.86-2.35 0-4.33-1.58-5.04-3.7H.96v2.32A9 9 0 0 0 9 18Z"
                    fill="#34A853"
                  />
                  <path
                    d="M3.96 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.28-1.72V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3-2.32Z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M9 3.58c1.32 0 2.5.46 3.44 1.34l2.58-2.58C13.46.9 11.42 0 9 0A9 9 0 0 0 .96 4.96l3 2.32c.71-2.12 2.69-3.7 5.04-3.7Z"
                    fill="#EA4335"
                  />
                </svg>
              </span>
              Continue with Google
            </button>

            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              <span>Email</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            {isSignUp && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-body"
                  placeholder="Your name"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Email *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-body"
                required
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Password *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 pr-10 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-body"
                  required
                  minLength={6}
                  placeholder="Min 6 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={submitting}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z"
                    fill="#4285F4"
                  />
                  <path
                    d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.82.86-3.06.86-2.35 0-4.33-1.58-5.04-3.7H.96v2.32A9 9 0 0 0 9 18Z"
                    fill="#34A853"
                  />
                  <path
                    d="M3.96 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.28-1.72V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3-2.32Z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M9 3.58c1.32 0 2.5.46 3.44 1.34l2.58-2.58C13.46.9 11.42 0 9 0A9 9 0 0 0 .96 4.96l3 2.32c.71-2.12 2.69-3.7 5.04-3.7Z"
                    fill="#EA4335"
                  />
                </svg>
              </span>
              Continue with Google
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
