import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Receipt, Mail, Lock, ShieldCheck, ArrowLeft, Sparkles } from "lucide-react";
import Maintenance from "@/pages/Maintenance";
import { z } from "zod";

const authSchema = z.object({
  email: z.string().email("Invalid email address").max(255, "Email too long"),
  password: z.string().min(6, "Password must be at least 6 characters").max(100, "Password too long"),
});

type AuthMode = "signin" | "signup" | "admin";

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<AuthMode>("signin");
  const [mounted, setMounted] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState<boolean | null>(null);

  useEffect(() => {
    setMounted(true);
    // Check maintenance mode
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", "maintenance_mode")
      .maybeSingle()
      .then(({ data }) => {
        setMaintenanceMode(data?.value === "true");
      });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/", { replace: true });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate("/", { replace: true });
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const validated = authSchema.parse({ email, password });
      setLoading(true);
      const { error } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      if (error) {
        toast.error(error.message.includes("User already registered") ? "Account already exists. Please sign in." : error.message);
      } else {
        toast.success("Account created! You can now sign in.");
        setMode("signin");
      }
    } catch (error) {
      toast.error(error instanceof z.ZodError ? error.errors[0].message : "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const validated = authSchema.parse({ email, password });
      setLoading(true);
      const { error, data } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });
      if (error) {
        toast.error(error.message.includes("Invalid login credentials") ? "Invalid email or password" : error.message);
      } else if (mode === "admin" && data.user) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id)
          .single();
        if (roleData?.role === "admin") {
          toast.success("Admin login successful!");
          navigate("/admin");
        } else {
          await supabase.auth.signOut();
          toast.error("Access denied. Admin privileges required.");
        }
      }
    } catch (error) {
      toast.error(error instanceof z.ZodError ? error.errors[0].message : "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setEmail("");
    setPassword("");
  };

  const titles: Record<AuthMode, string> = {
    signin: "Welcome Back",
    signup: "Create Account",
    admin: "Admin Access",
  };

  const descriptions: Record<AuthMode, string> = {
    signin: "Sign in to manage your digital receipts",
    signup: "Get started with your receipt management",
    admin: "Restricted area — admin credentials required",
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      {/* Animated background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full opacity-20 blur-3xl"
          style={{
            background: "hsl(var(--primary))",
            animation: "float-blob-1 8s ease-in-out infinite",
          }}
        />
        <div
          className="absolute -bottom-32 -right-32 h-[400px] w-[400px] rounded-full opacity-15 blur-3xl"
          style={{
            background: "hsl(var(--secondary))",
            animation: "float-blob-2 10s ease-in-out infinite",
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-10 blur-3xl"
          style={{
            background: "hsl(var(--accent))",
            animation: "float-blob-3 12s ease-in-out infinite",
          }}
        />
      </div>

      <div
        className={`relative z-10 w-full max-w-md transition-all duration-700 ease-out ${
          mounted ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
        }`}
      >
        {/* Logo & Title */}
        <div className="mb-8 text-center">
          <div
            className="group relative mx-auto mb-5 inline-flex h-20 w-20 items-center justify-center rounded-2xl shadow-strong transition-transform duration-500 hover:scale-110"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Receipt className="h-10 w-10 text-primary-foreground transition-transform duration-500 group-hover:rotate-12" />
            <Sparkles className="absolute -right-2 -top-2 h-5 w-5 text-accent animate-pulse" />
          </div>
          <h1 className="mb-1 text-3xl font-bold tracking-tight text-foreground">
            Digital Receipt System
          </h1>
          <p className="text-sm text-muted-foreground">Fast • Secure • Paperless</p>
        </div>

        {/* Card with transition */}
        <Card className="overflow-hidden border-border/50 shadow-strong backdrop-blur-sm bg-card/90">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              {mode === "admin" && (
                <ShieldCheck className="h-5 w-5 text-destructive" />
              )}
              <CardTitle
                key={mode}
                className="animate-fade-in text-xl"
              >
                {titles[mode]}
              </CardTitle>
            </div>
            <CardDescription
              key={`desc-${mode}`}
              className="animate-fade-in"
            >
              {descriptions[mode]}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <form
              onSubmit={mode === "signup" ? handleSignUp : handleSignIn}
              className="space-y-4"
              key={mode}
            >
              <div className="space-y-2 animate-fade-in" style={{ animationDelay: "0.05s" }}>
                <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value.trim())}
                    required
                    maxLength={255}
                    className="pl-10 h-11 transition-shadow duration-200 focus:shadow-medium"
                  />
                </div>
              </div>

              <div className="space-y-2 animate-fade-in" style={{ animationDelay: "0.1s" }}>
                <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    maxLength={100}
                    className="pl-10 h-11 transition-shadow duration-200 focus:shadow-medium"
                  />
                </div>
                {mode === "signup" && (
                  <p className="text-xs text-muted-foreground">Min 6 characters</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-sm font-semibold tracking-wide shadow-medium transition-all duration-300 hover:shadow-strong hover:scale-[1.02] active:scale-[0.98] animate-fade-in"
                style={{ animationDelay: "0.15s" }}
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    {mode === "signup" ? "Creating..." : "Signing in..."}
                  </span>
                ) : mode === "signup" ? (
                  "Create Account"
                ) : mode === "admin" ? (
                  "Admin Sign In"
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            {/* Mode switchers */}
            <div className="space-y-2 pt-2 animate-fade-in" style={{ animationDelay: "0.2s" }}>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>

              {mode === "signin" && (
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    className="w-full transition-all duration-200 hover:shadow-soft"
                    onClick={() => switchMode("signup")}
                  >
                    Create new account
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => switchMode("admin")}
                  >
                    <ShieldCheck className="mr-1 h-3 w-3" />
                    Admin Login
                  </Button>
                </div>
              )}

              {mode === "signup" && (
                <Button
                  variant="outline"
                  className="w-full transition-all duration-200 hover:shadow-soft"
                  onClick={() => switchMode("signin")}
                >
                  Already have an account? Sign in
                </Button>
              )}

              {mode === "admin" && (
                <Button
                  variant="ghost"
                  className="w-full gap-2 transition-all duration-200"
                  onClick={() => switchMode("signin")}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to regular login
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground animate-fade-in" style={{ animationDelay: "0.3s" }}>
          © {new Date().getFullYear()} Digital Receipt System
        </p>
      </div>

      {/* Inline keyframes for background blobs */}
      <style>{`
        @keyframes float-blob-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        @keyframes float-blob-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-40px, 30px) scale(1.15); }
          66% { transform: translate(25px, -40px) scale(0.85); }
        }
        @keyframes float-blob-3 {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.2); }
        }
      `}</style>
    </div>
  );
};

export default Auth;
