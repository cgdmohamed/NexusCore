import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link, useLocation, Redirect } from "wouter";
import { Loader2, Building2, KeyRound, ArrowLeft, CheckCircle2, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");

  const { data: tokenValidation, isLoading: isValidating } = useQuery({
    queryKey: ["/api/validate-reset-token", token],
    queryFn: async () => {
      if (!token) return { valid: false };
      const response = await fetch(`/api/validate-reset-token?token=${encodeURIComponent(token)}`);
      return response.json();
    },
    enabled: !!token,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsSubmitting(true);

    try {
      await apiRequest("POST", "/api/reset-password", { token, newPassword });
      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return <Redirect to="/forgot-password" />;
  }

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-screen">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center space-x-2">
              <Building2 className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">CompanyOS</h1>
            </div>
          </div>

          <Card>
            {!tokenValidation?.valid && !isSuccess ? (
              <div>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    <span>Invalid or Expired Link</span>
                  </CardTitle>
                  <CardDescription>
                    This password reset link is no longer valid
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                    <p className="text-sm text-destructive">
                      {tokenValidation?.message || "This reset link has expired or has already been used. Please request a new password reset."}
                    </p>
                  </div>
                  <Link href="/forgot-password">
                    <Button className="w-full" data-testid="button-request-new-reset">
                      Request New Reset Link
                    </Button>
                  </Link>
                  <Link href="/auth">
                    <Button variant="ghost" className="w-full" data-testid="link-back-to-login">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to Login
                    </Button>
                  </Link>
                </CardContent>
              </div>
            ) : isSuccess ? (
              <div>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span>Password Reset Successfully</span>
                  </CardTitle>
                  <CardDescription>
                    Your password has been updated
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <p className="text-sm text-green-800 dark:text-green-200">
                      Your password has been reset successfully. You can now log in with your new password.
                    </p>
                  </div>
                  <Link href="/auth">
                    <Button className="w-full" data-testid="button-go-to-login">
                      Go to Login
                    </Button>
                  </Link>
                </CardContent>
              </div>
            ) : (
              <div>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <KeyRound className="h-5 w-5" />
                    <span>Set New Password</span>
                  </CardTitle>
                  <CardDescription>
                    Enter your new password below
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <div className="relative">
                        <Input
                          id="newPassword"
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter new password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                          minLength={6}
                          data-testid="input-new-password"
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

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Confirm new password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          minLength={6}
                          data-testid="input-confirm-password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="text-sm text-muted-foreground">
                      <p>Password requirements:</p>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li className={newPassword.length >= 6 ? "text-green-600" : ""}>
                          At least 6 characters
                        </li>
                        <li className={newPassword && newPassword === confirmPassword ? "text-green-600" : ""}>
                          Passwords must match
                        </li>
                      </ul>
                    </div>

                    {error && (
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isSubmitting}
                      data-testid="button-reset-password"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Resetting Password...
                        </>
                      ) : (
                        "Reset Password"
                      )}
                    </Button>

                    <Link href="/auth">
                      <Button variant="ghost" className="w-full" data-testid="link-back-to-login">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Login
                      </Button>
                    </Link>
                  </form>
                </CardContent>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
