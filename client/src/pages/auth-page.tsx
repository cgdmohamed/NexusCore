import { useState } from "react";
import { useConfig } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { Redirect, Link } from "wouter";
import { Loader2, Eye, EyeOff, Building2 } from "lucide-react";

// Translation strings
const translations = {
  "auth.welcome_message": "Professional company management system for internal operations",
  "auth.login": "Login",
  "auth.login_title": "Welcome Back",
  "auth.login_description": "Sign in to access your company dashboard",
  "auth.username": "Username",
  "auth.password": "Password",
  "auth.forgot_password": "Forgot Password?",
  "auth.logging_in": "Signing in...",
  "auth.validation.required_fields": "Please fill in all required fields",
  "auth.login_failed": "Login failed. Please check your credentials.",
  "auth.features.title": "Comprehensive Business Management",
  "auth.features.subtitle": "Streamline your operations with our integrated platform",
  "auth.features.crm.title": "Client Relationship Management",
  "auth.features.crm.description": "Manage clients, quotations, and invoices efficiently",
  "auth.features.business.title": "Business Operations",
  "auth.features.business.description": "Track expenses, tasks, and team performance",
  "auth.features.security.title": "Enterprise Security",
  "auth.features.security.description": "Role-based access with secure authentication",
  "auth.features.international.title": "Multi-language Support",
  "auth.features.international.description": "Full Arabic and English interface support",
  "auth.security.title": "Secure Access",
  "auth.security.description": "Your data is protected with enterprise-grade security measures including encrypted passwords and secure session management.",
  "auth.forgot_password.title": "Reset Password",
  "auth.forgot_password.description": "Contact your system administrator to reset your password",
  "auth.forgot_password.message": "Please contact the system administrator at admin@company.com to reset your password. Include your username in the request.",
  "auth.back_to_login": "Back to Login"
};

export default function AuthPage() {
  const t = (key: string) => translations[key as keyof typeof translations] || key;
  const { user, isLoading, loginMutation } = useAuth();
  const { companyName } = useConfig();
  const [showPassword, setShowPassword] = useState(false);
  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [error, setError] = useState("");

  // Redirect if already authenticated
  if (!isLoading && user) {
    return <Redirect to="/" />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!loginData.username || !loginData.password) {
      setError(t("auth.validation.required_fields"));
      return;
    }

    try {
      await loginMutation.mutateAsync(loginData);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.login_failed"));
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Building2 className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{companyName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("auth.login_description")}</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username">{t("auth.username")}</Label>
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  value={loginData.username}
                  onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                  required
                  data-testid="input-username"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t("auth.password")}</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    data-testid="link-forgot-password"
                  >
                    {t("auth.forgot_password")}
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    className="pe-10"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    required
                    data-testid="input-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute end-0 top-0 h-full px-3 text-muted-foreground hover:bg-transparent hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={loginMutation.isPending} data-testid="button-login">
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    {t("auth.logging_in")}
                  </>
                ) : (
                  t("auth.login")
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">{t("auth.welcome_message")}</p>
      </div>
    </div>
  );
}
