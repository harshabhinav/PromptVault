import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, User, Mail, Lock, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";

export const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const { signUp, resendVerification } = useAuth();
  
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setErrorMessage("Please fill in all required fields.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const { error, requires_verification, message } = await signUp(fullName, email, password);
    setLoading(false);

    if (error) {
      setErrorMessage(error.message || "Failed to create account.");
    } else if (requires_verification) {
      setIsSubmitted(true);
      setSuccessNotice(message || "We've sent a verification link to your email.");
    }
  };

  const handleResend = async () => {
    setResending(true);
    setErrorMessage(null);
    setSuccessNotice(null);

    const { error, message } = await resendVerification(email);
    setResending(false);

    if (error) {
      setErrorMessage(error.message);
    } else {
      setSuccessNotice(message || "A new verification link has been sent to your email.");
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
          
          <h2 className="text-sm font-bold text-foreground/90 pt-3">
            {isSubmitted ? "Verify your email" : "Create your vault workspace"}
          </h2>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success Alert */}
        {successNotice && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Confirmation Screen */}
        {isSubmitted ? (
          <div className="space-y-5 text-center py-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Mail className="h-6 w-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-bold text-foreground">Check your email</h3>
              <p className="text-xs text-muted-foreground leading-relaxed px-2">
                We've sent a secure verification link to <span className="font-semibold text-foreground">{email}</span>.
                Click the link in your email to activate your PromptVault account.
              </p>
              <p className="text-[11px] text-muted-foreground/80">
                The link expires in 60 minutes.
              </p>
            </div>

            <div className="space-y-2 pt-3">
              <Button
                type="button"
                variant="outline"
                isLoading={resending}
                disabled={resending}
                onClick={handleResend}
                className="w-full h-9 text-xs font-semibold border-border/80 hover:bg-muted/40 flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Resend Verification Email
              </Button>

              <Button
                type="button"
                onClick={() => navigate("/login")}
                className="w-full h-9 text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-md transition-all duration-200"
              >
                Back to Sign In
              </Button>
            </div>
          </div>
        ) : (
          /* Sign Up Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="signup-name" className="text-xs font-semibold text-muted-foreground">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                <Input
                  id="signup-name"
                  type="text"
                  required
                  placeholder="Enter your name"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-9 text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-email" className="text-xs font-semibold text-muted-foreground">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                <Input
                  id="signup-email"
                  type="email"
                  required
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-password" className="text-xs font-semibold text-muted-foreground">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                <Input
                  id="signup-password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-confirm-password" className="text-xs font-semibold text-muted-foreground">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                <Input
                  id="signup-confirm-password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-9 text-xs h-9"
                />
              </div>
            </div>

            <Button
              type="submit"
              isLoading={loading}
              disabled={loading}
              className="w-full h-9 text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-md transition-all duration-200 mt-2"
            >
              Create Account
            </Button>
          </form>
        )}

        {/* Navigation Switch */}
        {!isSubmitted && (
          <div className="text-center pt-2 text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-indigo-400 font-bold hover:underline">
              Sign In
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  );
};

