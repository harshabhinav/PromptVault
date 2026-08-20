import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, CheckCircle2, AlertTriangle, XCircle, RefreshCw, ArrowRight } from "lucide-react";
import { authApi } from "../services/api";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";

type VerificationStatus = "loading" | "success" | "already_verified" | "expired" | "invalid";

export const VerifyEmail: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<VerificationStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !token.trim()) {
      setStatus("invalid");
      setErrorMessage("No verification token was provided in the link.");
      return;
    }

    const verify = async () => {
      try {
        const res = await authApi.verifyEmail(token.trim());
        if (res.status === "already_verified") {
          setStatus("already_verified");
        } else {
          setStatus("success");
        }
      } catch (err: any) {
        const detail = err.response?.data?.detail || err.message || "";
        if (detail.toLowerCase().includes("expired")) {
          setStatus("expired");
          setErrorMessage("Your verification link has expired. Request a new verification email below.");
        } else if (detail.toLowerCase().includes("already verified")) {
          setStatus("already_verified");
        } else {
          setStatus("invalid");
          setErrorMessage(detail || "This verification link is invalid or no longer available.");
        }
      }
    };

    verify();
  }, [token]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail.trim()) return;

    setResending(true);
    setResendSuccess(null);
    setErrorMessage(null);

    try {
      const res = await authApi.resendVerification(resendEmail.trim());
      setResendSuccess(res.message || "A new verification link has been sent to your email.");
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || "Unable to resend verification email.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 relative overflow-hidden select-none font-sans">
      {/* Subtle Background Pattern */}
      <div className="absolute inset-0 bg-dot-pattern opacity-40 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="w-full max-w-md bg-card/60 backdrop-blur-xl border border-border/80 rounded-2xl p-8 shadow-2xl z-10 space-y-6"
      >
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 mb-1">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-black uppercase tracking-wider text-gradient">PromptVault</h1>
          <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Version & Compare</span>
        </div>

        {/* Status: Loading */}
        {status === "loading" && (
          <div className="py-8 flex flex-col items-center justify-center space-y-4 text-center">
            <div className="h-8 w-8 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
            <p className="text-xs text-muted-foreground font-medium">Verifying your email address...</p>
          </div>
        )}

        {/* Status: Success */}
        {status === "success" && (
          <div className="py-4 space-y-5 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="h-7 w-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold text-foreground">Email Verified!</h2>
              <p className="text-xs text-muted-foreground leading-relaxed px-2">
                Your PromptVault account has been successfully verified. You can now sign in and start versioning and comparing your prompts.
              </p>
            </div>

            <Button
              type="button"
              onClick={() => navigate("/login")}
              className="w-full h-9 text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-md transition-all duration-200 flex items-center justify-center gap-2"
            >
              Continue to Sign In
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Status: Already Verified */}
        {status === "already_verified" && (
          <div className="py-4 space-y-5 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-lg shadow-indigo-500/10">
              <Sparkles className="h-7 w-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold text-foreground">Email Already Verified</h2>
              <p className="text-xs text-muted-foreground leading-relaxed px-2">
                This email address is already verified. You can sign in to your PromptVault workspace directly.
              </p>
            </div>

            <Button
              type="button"
              onClick={() => navigate("/login")}
              className="w-full h-9 text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-md transition-all duration-200"
            >
              Sign In
            </Button>
          </div>
        )}

        {/* Status: Expired */}
        {status === "expired" && (
          <div className="py-4 space-y-5 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <AlertTriangle className="h-7 w-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold text-foreground">Verification Link Expired</h2>
              <p className="text-xs text-muted-foreground leading-relaxed px-2">
                Your verification link has expired. Enter your email below to receive a fresh verification link.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
                {errorMessage}
              </div>
            )}

            {resendSuccess && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                {resendSuccess}
              </div>
            )}

            <form onSubmit={handleResend} className="space-y-3 pt-2 text-left">
              <div className="space-y-1.5">
                <Label htmlFor="resend-email" className="text-xs font-semibold text-muted-foreground">Email Address</Label>
                <Input
                  id="resend-email"
                  type="email"
                  required
                  placeholder="Enter your registered email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              <Button
                type="submit"
                isLoading={resending}
                disabled={resending}
                className="w-full h-9 text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-md transition-all duration-200 flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Resend Verification Email
              </Button>
            </form>

            <div className="pt-2 text-center">
              <Link to="/login" className="text-xs text-muted-foreground hover:text-foreground">
                Back to Sign In
              </Link>
            </div>
          </div>
        )}

        {/* Status: Invalid */}
        {status === "invalid" && (
          <div className="py-4 space-y-5 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <XCircle className="h-7 w-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold text-foreground">Invalid Verification Link</h2>
              <p className="text-xs text-muted-foreground leading-relaxed px-2">
                This verification link is invalid or no longer available.
              </p>
            </div>

            <Button
              type="button"
              onClick={() => navigate("/login")}
              className="w-full h-9 text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-md transition-all duration-200"
            >
              Back to Sign In
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
