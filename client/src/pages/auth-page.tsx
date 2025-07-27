import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { Redirect } from "wouter";
// import { useTranslation } from "react-i18next";
import { Loader2, Eye, EyeOff, Building2, Shield, Globe, Users } from "lucide-react";

export default function AuthPage() {
  // const { t } = useTranslation();
  const t = (key: string) => key; // Temporary fallback
  const { user, isLoading, loginMutation, registerMutation } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [registerData, setRegisterData] = useState({
    username: "",
    email: "",
    firstName: "",
    lastName: "",
    password: "",
    confirmPassword: ""
  });
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!registerData.username || !registerData.email || !registerData.password || !registerData.firstName) {
      setError(t("auth.validation.required_fields"));
      return;
    }

    if (registerData.password !== registerData.confirmPassword) {
      setError(t("auth.validation.passwords_match"));
      return;
    }

    try {
      const { confirmPassword, ...userData } = registerData;
      await registerMutation.mutateAsync(userData);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.registration_failed"));
    }
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
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">{t("auth.login")}</TabsTrigger>
                  <TabsTrigger value="register">{t("auth.register")}</TabsTrigger>
                </TabsList>

                {/* Login Tab */}
                <TabsContent value="login">
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
                </TabsContent>

                {/* Register Tab */}
                <TabsContent value="register">
                  <CardHeader>
                    <CardTitle>{t("auth.register_title")}</CardTitle>
                    <CardDescription>{t("auth.register_description")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleRegister} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">{t("auth.first_name")}</Label>
                          <Input
                            id="firstName"
                            type="text"
                            value={registerData.firstName}
                            onChange={(e) => setRegisterData({ ...registerData, firstName: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName">{t("auth.last_name")}</Label>
                          <Input
                            id="lastName"
                            type="text"
                            value={registerData.lastName}
                            onChange={(e) => setRegisterData({ ...registerData, lastName: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="registerUsername">{t("auth.username")}</Label>
                        <Input
                          id="registerUsername"
                          type="text"
                          value={registerData.username}
                          onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">{t("auth.email")}</Label>
                        <Input
                          id="email"
                          type="email"
                          value={registerData.email}
                          onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="registerPassword">{t("auth.password")}</Label>
                        <Input
                          id="registerPassword"
                          type="password"
                          value={registerData.password}
                          onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">{t("auth.confirm_password")}</Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          value={registerData.confirmPassword}
                          onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                          required
                        />
                      </div>
                      {error && (
                        <Alert variant="destructive">
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      )}
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={registerMutation.isPending}
                      >
                        {registerMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t("auth.registering")}
                          </>
                        ) : (
                          t("auth.register")
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </TabsContent>
              </Tabs>
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