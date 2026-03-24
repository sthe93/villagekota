import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Footer from "@/components/Footer";
import { Fingerprint, Loader2, ScanFace, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  enrollBiometricCredential,
  getStoredBiometricCredential,
  isBiometricPlatformAvailable,
  verifyBiometricCredential,
} from "@/lib/biometricAuth";

export default function AuthPage() {
  const [submitting, setSubmitting] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);
  const { signInWithGoogle, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const handledGoogleRedirect = useRef(false);

  const storedBiometricCredential = useMemo(() => {
    if (!biometricEnrolled) return null;
    return getStoredBiometricCredential();
  }, [biometricEnrolled]);

  const redirectAfterLogin = useCallback(async (
    userId: string,
    successMessage = "Signed in successfully"
  ) => {
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
  }, [navigate]);

  useEffect(() => {
    let isMounted = true;

    const loadBiometricState = async () => {
      const supported = await isBiometricPlatformAvailable();
      if (!isMounted) return;

      setBiometricSupported(supported);
      setBiometricEnrolled(Boolean(getStoredBiometricCredential()));
    };

    void loadBiometricState();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (loading || !user || handledGoogleRedirect.current) {
      return;
    }

    handledGoogleRedirect.current = true;
    const provider = new URLSearchParams(location.search).get("provider");
    const successMessage = provider === "google" ? "Signed in with Google" : "Signed in successfully";
    void redirectAfterLogin(user.id, successMessage);
  }, [loading, location.search, redirectAfterLogin, user]);

  const handleGoogleSignIn = async () => {
    setSubmitting(true);

    try {
      const { error } = await signInWithGoogle();
      if (error) throw error;
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Unable to continue with Google"
      );
      setSubmitting(false);
    }
  };

  const handleBiometricEnroll = async () => {
    setBiometricLoading(true);

    try {
      await enrollBiometricCredential();
      setBiometricEnrolled(true);
      toast.success("Biometric sign-in enabled", {
        description: "You can now use Face ID or fingerprint on this device before Google sign-in.",
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Unable to enable biometric sign-in"
      );
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleBiometricSignIn = async () => {
    setBiometricLoading(true);

    try {
      await verifyBiometricCredential();
      toast.success("Biometric check complete", {
        description: "Device verification passed. Continue with your Google account.",
      });
      await handleGoogleSignIn();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Biometric verification failed"
      );
    } finally {
      setBiometricLoading(false);
    }
  };

  return (
    <div>
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="font-display text-5xl text-foreground mb-2">
              WELCOME
            </h1>
            <p className="text-muted-foreground font-body text-sm">
              Continue with Google to access Village Kota
            </p>
          </div>

          <div className="bg-card rounded-lg border border-border p-6 space-y-4">
            <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground font-body">
              Google sign-in is currently the active login method. Continue with
              your Google account to sign in or create your account.
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-primary/10 p-2 text-primary">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">Secure, low-friction access</p>
                  <p className="text-muted-foreground">
                    Sign in with Google everywhere, and optionally add a device-level biometric check for faster return visits.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={submitting}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span aria-hidden="true">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  xmlns="http://www.w3.org/2000/svg"
                >
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
              {submitting ? "Connecting..." : "Continue with Google"}
            </button>

            {biometricSupported && (
              <div className="space-y-3 rounded-lg border border-border bg-background p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-muted p-2 text-foreground">
                    {biometricEnrolled ? (
                      <ScanFace className="h-4 w-4" />
                    ) : (
                      <Fingerprint className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {biometricEnrolled ? "Biometric verification enabled" : "Add biometric verification"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {biometricEnrolled
                        ? `Saved on this device${storedBiometricCredential ? ` · enrolled ${new Date(storedBiometricCredential.enrolledAt).toLocaleDateString("en-ZA")}` : ""}.`
                        : "Use Face ID or fingerprint as an extra verification step before Google sign-in."}
                    </p>
                  </div>
                </div>

                {!biometricEnrolled ? (
                  <button
                    type="button"
                    onClick={handleBiometricEnroll}
                    disabled={biometricLoading || submitting}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {biometricLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Fingerprint className="h-4 w-4" />
                    )}
                    Enable on this device
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleBiometricSignIn}
                    disabled={biometricLoading || submitting}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-primary bg-primary/5 px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {biometricLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ScanFace className="h-4 w-4" />
                    )}
                    Verify and continue
                  </button>
                )}
              </div>
            )}

            <p className="text-center text-xs text-muted-foreground font-body">
              By continuing, you’ll sign in securely using your Google account.
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
