import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { Redirect } from "wouter";
import { Loader2, Eye, EyeOff, Building2, Shield, Globe, Users, KeyRound } from "lucide-react";

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
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
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

  const handleForgotPassword = () => {
    setShowForgotPassword(true);
    setError("");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8 min-h-screen items-center">
          {/* Left Side - Authentication Forms */}
          <div className="flex flex-col justify-center space-y-6">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center space-x-2">
                <Building2 className="h-8 w-8 text-primary" />
                <h1 className="text-3xl font-bold">CompanyOS</h1>
              </div>
              <p className="text-muted-foreground">
                {t("auth.welcome_message")}
              </p>
            </div>

            <Card className="mx-auto w-full max-w-md">
              {showForgotPassword ? (
                // Forgot Password View
                <div>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <KeyRound className="h-5 w-5" />
                      <span>{t("auth.forgot_password.title")}</span>
                    </CardTitle>
                    <CardDescription>{t("auth.forgot_password.description")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        {t("auth.forgot_password.message")}
                      </p>
                    </div>
                    <Button
                      onClick={() => setShowForgotPassword(false)}
                      variant="outline"
                      className="w-full"
                    >
                      {t("auth.back_to_login")}
                    </Button>
                  </CardContent>
                </div>
              ) : (
                // Login View
                <div>
                  <CardHeader>
                    <CardTitle>{t("auth.login_title")}</CardTitle>
                    <CardDescription>{t("auth.login_description")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="username">{t("auth.username")}</Label>
                        <Input
                          id="username"
                          type="text"
                          value={loginData.username}
                          onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">{t("auth.password")}</Label>
                        <div className="relative">
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            value={loginData.password}
                            onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                            required
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          onClick={handleForgotPassword}
                          className="px-0 text-sm text-muted-foreground hover:text-primary"
                        >
                          {t("auth.forgot_password")}
                        </Button>
                      </div>

                      {error && (
                        <Alert variant="destructive">
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      )}
                      
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={loginMutation.isPending}
                      >
                        {loginMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t("auth.logging_in")}
                          </>
                        ) : (
                          t("auth.login")
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </div>
              )}
            </Card>
          </div>

          {/* Right Side - Feature Showcase */}
          <div className="hidden lg:flex flex-col justify-center space-y-8 px-8">
            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-foreground">
                {t("auth.features.title")}
              </h2>
              <p className="text-lg text-muted-foreground">
                {t("auth.features.subtitle")}
              </p>
            </div>

            <div className="grid gap-6">
              <div className="flex items-start space-x-4">
                <div className="bg-primary/10 p-3 rounded-lg">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{t("auth.features.crm.title")}</h3>
                  <p className="text-muted-foreground">{t("auth.features.crm.description")}</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="bg-primary/10 p-3 rounded-lg">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{t("auth.features.business.title")}</h3>
                  <p className="text-muted-foreground">{t("auth.features.business.description")}</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="bg-primary/10 p-3 rounded-lg">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{t("auth.features.security.title")}</h3>
                  <p className="text-muted-foreground">{t("auth.features.security.description")}</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="bg-primary/10 p-3 rounded-lg">
                  <Globe className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{t("auth.features.international.title")}</h3>
                  <p className="text-muted-foreground">{t("auth.features.international.description")}</p>
                </div>
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-6">
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-primary" />
                <span className="font-semibold text-primary">{t("auth.security.title")}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {t("auth.security.description")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}