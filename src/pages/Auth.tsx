import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import logo from "@/assets/logo.svg";
import {
  ArrowRight,
  Loader2,
  Mail,
  ShieldCheck,
  UserRound,
  UserX,
} from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sign-up role choice: Employee or HR (persisted on the user document).
  const [role, setRole] = useState<"employee" | "hr">("hr");
  const setAppRole = useMutation(api.selfservice.setMyAppRole);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    if (user === undefined) return; // wait for the user document to load

    // A specific returnTo destination always wins.
    if (searchParams.get("returnTo")) {
      navigate(redirect, { replace: true });
      return;
    }
    // Role-aware landing: linked employees and Employee-role sign-ups go
    // straight to self-service (spec §35); HR-role sign-ups land on the
    // company overview. Both this session's choice and a previously saved
    // role are honoured so returning users keep their landing page.
    const isEmployeeView = role === "employee" || user?.appRole === "employee";
    if (user?.employeeId || isEmployeeView) {
      navigate("/my", { replace: true });
      return;
    }
    navigate(redirect, { replace: true });
  }, [authLoading, isAuthenticated, user, navigate, redirect, searchParams, role]);
  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string });
      setIsLoading(false);
    } catch (error) {
      console.error("Email sign-in error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to send verification code. Please try again.",
      );
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      // Persist the role chosen on the sign-in card; the redirect effect
      // routes Employee → /my and HR → /dashboard.
      try {
        await setAppRole({ appRole: role });
      } catch (roleError) {
        console.error("Failed to save role:", roleError);
      }
    } catch (error) {
      console.error("OTP verification error:", error);

      setError("The verification code you entered is incorrect.");
      setIsLoading(false);

      setOtp("");
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log("Attempting anonymous sign in...");
      await signIn("anonymous");
      console.log("Anonymous sign in successful");
      try {
        await setAppRole({ appRole: role });
      } catch (roleError) {
        console.error("Failed to save role:", roleError);
      }
      // Routing is handled by the effect above once the user doc loads.
    } catch (error) {
      console.error("Guest login error:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      setError(`Failed to sign in as guest: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">

      
      {/* Auth Content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center justify-center h-full flex-col">
        <Card className="glass-strong min-w-[350px] pb-0 border-0 shadow-xl">
          {step === "signIn" ? (
            <>
              <CardHeader className="text-center">
              <div className="flex justify-center">
                    <img
                      src={logo}
                      alt="Lock Icon"
                      width={64}
                      height={64}
                      className="rounded-lg mb-4 mt-4 cursor-pointer"
                      onClick={() => navigate("/")}
                    />
                  </div>
                <CardTitle className="text-xl">Get Started</CardTitle>
                <CardDescription>
                  Choose your role, then enter your email to log in or sign up
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleEmailSubmit}>
                <CardContent>
                  <div className="mb-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      I am signing up as
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        aria-pressed={role === "hr"}
                        onClick={() => setRole("hr")}
                        className={`flex flex-col items-center gap-1 rounded-xl px-3 py-3 text-center transition ${
                          role === "hr"
                            ? "border border-primary/50 bg-primary/10 text-primary shadow-sm"
                            : "glass-subtle text-muted-foreground hover:bg-white/70"
                        }`}
                      >
                        <ShieldCheck className="size-5" />
                        <span className="text-sm font-semibold">HR</span>
                        <span className="text-[11px] leading-tight">
                          People, payroll &amp; approvals
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-pressed={role === "employee"}
                        onClick={() => setRole("employee")}
                        className={`flex flex-col items-center gap-1 rounded-xl px-3 py-3 text-center transition ${
                          role === "employee"
                            ? "border border-primary/50 bg-primary/10 text-primary shadow-sm"
                            : "glass-subtle text-muted-foreground hover:bg-white/70"
                        }`}
                      >
                        <UserRound className="size-5" />
                        <span className="text-sm font-semibold">Employee</span>
                        <span className="text-[11px] leading-tight">
                          Payslips &amp; leave requests
                        </span>
                      </button>
                    </div>
                  </div>
                  
                  <div className="relative flex items-center gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        name="email"
                        placeholder="name@example.com"
                        type="email"
                        className="pl-9"
                        disabled={isLoading}
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="outline"
                      size="icon"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {error && (
                    <p className="mt-2 text-sm text-red-500">{error}</p>
                  )}
                  
                  <div className="mt-4">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">
                          Or
                        </span>
                      </div>
                    </div>
                    
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full mt-4"
                      onClick={handleGuestLogin}
                      disabled={isLoading}
                    >
                      <UserX className="mr-2 h-4 w-4" />
                      Continue as Guest
                    </Button>
                  </div>
                </CardContent>
              </form>
            </>
          ) : (
            <>
              <CardHeader className="text-center mt-4">
                <CardTitle>Check your email</CardTitle>
                <CardDescription>
                  We've sent a code to {step.email}
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleOtpSubmit}>
                <CardContent className="pb-4">
                  <input type="hidden" name="email" value={step.email} />
                  <input type="hidden" name="code" value={otp} />

                  <div className="flex justify-center">
                    <InputOTP
                      value={otp}
                      onChange={setOtp}
                      maxLength={6}
                      disabled={isLoading}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && otp.length === 6 && !isLoading) {
                          // Find the closest form and submit it
                          const form = (e.target as HTMLElement).closest("form");
                          if (form) {
                            form.requestSubmit();
                          }
                        }
                      }}
                    >
                      <InputOTPGroup>
                        {Array.from({ length: 6 }).map((_, index) => (
                          <InputOTPSlot key={index} index={index} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  {error && (
                    <p className="mt-2 text-sm text-red-500 text-center">
                      {error}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground text-center mt-4">
                    Didn't receive a code?{" "}
                    <Button
                      variant="link"
                      className="p-0 h-auto"
                      onClick={() => setStep("signIn")}
                    >
                      Try again
                    </Button>
                  </p>
                </CardContent>
                <CardFooter className="flex-col gap-2">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading || otp.length !== 6}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        Verify code
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep("signIn")}
                    disabled={isLoading}
                    className="w-full"
                  >
                    Use different email
                  </Button>
                </CardFooter>
              </form>
            </>
          )}

          <div className="py-4 px-6 text-xs text-center text-muted-foreground bg-muted border-t rounded-b-lg">
            Secured by{" "}
            <a
              href="https://freebuff.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-primary transition-colors"
            >
              freebuff.com
            </a>
          </div>
        </Card>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
