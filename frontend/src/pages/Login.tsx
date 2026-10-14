import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Sparkles, Mail, Lock, User, AlertCircle, GitBranch, FolderLock, FilePlus, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";

const heroSubtitles = [
  "Version Control for AI Prompts.",
  "AI Workflow Management.",
  "Prompt Testing & Optimization.",
  "Your AI Prompt Workspace."
];

export const Login: React.FC<{ initialMode?: "signin" | "signup" }> = ({ initialMode = "signin" }) => {
  const navigate = useNavigate();
  const { signInWithEmail, signUp, resendVerification, signInWithGoogle } = useAuth();
  const shouldReduceMotion = useReducedMotion();
  
  // Rotating Subtitle Index
  const [currentSubtitleIndex, setCurrentSubtitleIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSubtitleIndex((prev) => (prev + 1) % heroSubtitles.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Explicitly clear any legacy remembered email to ensure clean state
    localStorage.removeItem("promptvault_remembered_email");
    
    setEmail("");
    setPassword("");
    
    // Cleanup on unmount to completely wipe state from memory
    return () => {
      setEmail("");
      setPassword("");
    };
  }, []);

  // In-place Auth Mode State
  const [authMode, setAuthMode] = useState<"signin" | "signup" | "check_email">(initialMode);

  // Form Fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [isNavigatingToDashboard, setIsNavigatingToDashboard] = useState(false);

  const navigateToDashboardWithTransition = async () => {
    setIsNavigatingToDashboard(true);
    await new Promise((res) => setTimeout(res, 400));
    navigate("/", { replace: true });
  };

  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [resendCountdown]);

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMessage("Please fill in all required fields.");
      return;
    }
    
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const { error } = await signInWithEmail(email, password);
    setLoading(false);

    if (!error) {
      localStorage.removeItem("promptvault_remembered_email");
      setEmail("");
      setPassword("");
    }

    if (error) {
      setErrorMessage(error.message || "Failed to sign in. Please check your credentials.");
      setPassword("");
    } else {
      await navigateToDashboardWithTransition();
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
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
    setSuccessMessage(null);

    const { error, requires_verification, message } = await signUp(fullName, email, password);
    setLoading(false);

    if (error) {
      setErrorMessage(error.message || "Failed to create account.");
    } else if (requires_verification) {
      setAuthMode("check_email");
      setResendCountdown(60);
      setSuccessMessage(message || "We've sent a verification link to your email.");
    }
  };

  const handleResendVerification = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const { error, message } = await resendVerification(email);
    setLoading(false);
    
    if (error) {
      setErrorMessage(error.message || "Failed to resend verification email.");
    } else {
      setResendCountdown(60);
      setSuccessMessage(message || "A new verification link has been sent to your email.");
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setErrorMessage(null);
    const { error } = await signInWithGoogle();
    setGoogleLoading(false);
    if (error) {
      setErrorMessage(error.message || "Failed to initiate Google sign in.");
    } else {
      await navigateToDashboardWithTransition();
    }
  };

  const switchAuthMode = (mode: "signin" | "signup" | "check_email") => {
    setErrorMessage(null);
    setSuccessMessage(null);
    if (mode !== "check_email") {
      setFullName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    }
    setAuthMode(mode);
  };

  const handleStartBuildingFree = () => {
    switchAuthMode("signup");
    const authElement = document.getElementById("auth");
    if (authElement) {
      authElement.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    setTimeout(() => {
      const nameInput = document.getElementById("signup-name");
      if (nameInput) {
        nameInput.focus();
      }
    }, 650);
  };

  const handleExploreFeatures = () => {
    const featuresElement = document.getElementById("features");
    if (featuresElement) {
      featuresElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{
        opacity: isNavigatingToDashboard ? 0 : 1,
        scale: isNavigatingToDashboard ? 0.98 : 1,
        filter: isNavigatingToDashboard ? "blur(6px)" : "blur(0px)",
      }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="min-h-screen bg-background text-foreground flex flex-col justify-between overflow-x-hidden font-sans select-none relative"
    >
      {/* Background Dot Grid Pattern & Radial Glows */}
      <div className="absolute inset-0 bg-dot-pattern opacity-30 pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Main Split Screen Hero Section */}
      <div className="w-full max-w-7xl mx-auto min-h-screen grid grid-cols-1 lg:grid-cols-2 gap-12 items-center px-4 sm:px-6 lg:px-8 py-12 lg:py-16 z-10">
        
        {/* Left Side: AI Branding Section */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="flex flex-col items-start justify-center space-y-6 text-left lg:pr-8"
        >
          {/* AI Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold tracking-wide shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI PROMPT MANAGEMENT PLATFORM</span>
          </div>

          {/* Headline Container with Centered Behind Glow */}
          <div className="relative w-full">
            {/* Centered Ambient Glow behind heading */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 sm:w-96 lg:w-[450px] h-32 sm:h-44 bg-gradient-to-r from-purple-600/25 via-indigo-500/20 to-purple-600/25 rounded-full blur-3xl sm:blur-[100px] pointer-events-none -z-10 animate-pulse" />
            
            <h1 className="relative z-10 text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-none">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-purple-400">PromptVault</span>
            </h1>
            {/* Right-to-Left One-by-One Fade & Slide Subtitle Slideshow */}
            <div className="relative z-10 h-8 sm:h-9 lg:h-10 mt-2 overflow-hidden flex items-center">
              <AnimatePresence mode="wait">
                <motion.p
                  key={currentSubtitleIndex}
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 40 }}
                  animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -40 }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-100 tracking-tight whitespace-nowrap"
                >
                  {heroSubtitles[currentSubtitleIndex]}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>

          {/* Description */}
          <p className="text-base sm:text-lg text-muted-foreground/80 max-w-xl leading-relaxed font-normal">
            A complete workspace to create, version, test, and optimize your AI prompts in one organized environment.
          </p>

          {/* Quick Metrics Badge Row */}
          <div className="pt-4 grid grid-cols-3 gap-6 border-t border-border/30 w-full max-w-md">
            <div>
              <div className="text-xl font-bold text-foreground">100%</div>
              <div className="text-xs text-muted-foreground">Versioned</div>
            </div>
            <div>
              <div className="text-xl font-bold text-foreground">Side-by-Side</div>
              <div className="text-xs text-muted-foreground">Evaluation</div>
            </div>
            <div>
              <div className="text-xl font-bold text-foreground">Secure Vault</div>
              <div className="text-xs text-muted-foreground">Your data stays yours</div>
            </div>
          </div>
        </motion.div>

        {/* Right Side: Fixed Authentication Card with In-Place Form Transition */}
        <motion.div
          id="auth"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut", delay: 0.1 }}
          className="w-full max-w-md mx-auto lg:ml-auto"
        >
          <div className="bg-card/70 backdrop-blur-2xl border border-border/80 hover:border-indigo-500/30 rounded-2xl p-8 shadow-2xl space-y-6 relative overflow-hidden transition-all duration-300 ease-in-out hover:scale-[1.01] hover:shadow-indigo-500/10">
            {/* Ambient Card Top Glow */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

            {/* Header Branding (Fixed Header) */}
            <video
              src="/pv-logo-loop.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="w-20 h-20 mx-auto mb-5 object-contain"
            />

            {/* Error Alert */}
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2 font-medium"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </motion.div>
            )}

            {/* Success Alert */}
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2 font-medium"
              >
                <Sparkles className="h-4 w-4 shrink-0" />
                <span>{successMessage}</span>
              </motion.div>
            )}

            {/* In-Place Form Transition (Sign In vs Create Account) */}
            <AnimatePresence mode="wait">
              {authMode === "signin" ? (
                <motion.div
                  key="signin"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="space-y-6"
                >
                  <div className="text-center space-y-1.5">
                    <h2 className="text-xl font-black text-foreground">Sign in to your vault</h2>
                    <p className="text-xs font-medium text-muted-foreground">Continue building better AI prompts.</p>
                  </div>

                  {/* Sign In Form */}
                  <form onSubmit={handleSignInSubmit} className="space-y-4">
                    
                    <div className="space-y-1.5">
                      <Label htmlFor="login-email" className="text-xs font-semibold text-muted-foreground">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                        <Input
                          id="login-email"
                          type="email"
                          required
                          placeholder="Enter your email"
                          autoComplete="off"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-9 text-xs h-9 transition-all duration-200 ease-in-out focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/80 hover:border-border/90"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="login-password" className="text-xs font-semibold text-muted-foreground">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                        <Input
                          id="login-password"
                          type="password"
                          required
                          placeholder="Enter your password"
                          autoComplete="new-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-9 text-xs h-9 transition-all duration-200 ease-in-out focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/80 hover:border-border/90"
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      isLoading={loading}
                      disabled={loading || googleLoading}
                      className="w-full h-9 text-xs font-bold bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:brightness-110 text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 ease-in-out hover:scale-[1.01] hover:shadow-indigo-500/40 active:scale-[0.99] mt-2 cursor-pointer"
                    >
                      Sign In
                    </Button>
                  </form>

                  {/* Divider */}
                  <div className="relative flex items-center justify-center my-4">
                    <div className="border-t border-border/60 w-full" />
                    <span className="bg-card px-3 text-[10px] uppercase font-mono tracking-widest text-muted-foreground/70 shrink-0">
                      OR
                    </span>
                    <div className="border-t border-border/60 w-full" />
                  </div>

                  {/* Google OAuth Button */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGoogleSignIn}
                    isLoading={googleLoading}
                    disabled={loading || googleLoading}
                    className="w-full h-9 text-xs font-semibold border-border/70 bg-secondary/30 hover:bg-secondary/70 hover:border-border text-foreground flex items-center justify-center gap-2 transition-all duration-200 ease-in-out hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                  >
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </Button>

                  {/* Navigation Switch to Create Account */}
                  <div className="text-center pt-2 text-xs text-muted-foreground">
                    Don't have an account?{" "}
                    <button
                      type="button"
                      onClick={() => switchAuthMode("signup")}
                      className="text-indigo-400 font-bold hover:underline cursor-pointer"
                    >
                      Create one
                    </button>
                  </div>
                </motion.div>
              ) : authMode === "signup" ? (
                <motion.div
                  key="signup"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="space-y-6"
                >
                  <div className="text-center space-y-1.5">
                    <h2 className="text-xl font-black text-foreground">Create your vault account</h2>
                    <p className="text-xs font-medium text-muted-foreground">Start organizing your AI prompts today.</p>
                  </div>

                  {/* Sign Up Form */}
                  <form onSubmit={handleSignUpSubmit} className="space-y-3.5">
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
                          className="pl-9 text-xs h-9 transition-all duration-200 ease-in-out focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/80 hover:border-border/90"
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
                          className="pl-9 text-xs h-9 transition-all duration-200 ease-in-out focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/80 hover:border-border/90"
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
                          placeholder="Enter your password"
                          autoComplete="new-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-9 text-xs h-9 transition-all duration-200 ease-in-out focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/80 hover:border-border/90"
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
                          placeholder="Confirm your password"
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="pl-9 text-xs h-9 transition-all duration-200 ease-in-out focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/80 hover:border-border/90"
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      isLoading={loading}
                      disabled={loading || googleLoading}
                      className="w-full h-9 text-xs font-bold bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:brightness-110 text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 ease-in-out hover:scale-[1.01] hover:shadow-indigo-500/40 active:scale-[0.99] mt-2 cursor-pointer"
                    >
                      Create Account
                    </Button>
                  </form>

                  {/* Navigation Switch back to Sign In */}
                  <div className="text-center pt-2 text-xs text-muted-foreground">
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => switchAuthMode("signin")}
                      className="text-indigo-400 font-bold hover:underline cursor-pointer"
                    >
                      Sign In
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="check_email"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="space-y-6 text-center"
                >
                  <div className="mx-auto w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Mail className="h-6 w-6" />
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-xl font-black text-foreground">Check your email</h2>
                    <p className="text-xs text-muted-foreground leading-relaxed px-2">
                      We've sent a secure verification link to <span className="font-semibold text-foreground">{email}</span>.
                      Click the link in your email to activate your account.
                    </p>
                    <p className="text-[11px] text-muted-foreground/80">
                      The link expires in 60 minutes.
                    </p>
                  </div>

                  <div className="space-y-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleResendVerification}
                      disabled={loading || resendCountdown > 0}
                      className="w-full h-9 text-xs font-semibold hover:bg-white/5 border-border/50 text-foreground"
                    >
                      {resendCountdown > 0 
                        ? `Resend Email (${resendCountdown}s)` 
                        : "Resend Verification Email"}
                    </Button>

                    <Button
                      type="button"
                      onClick={() => switchAuthMode("signin")}
                      className="w-full h-9 text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-md transition-all duration-200"
                    >
                      Back to Sign In
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

      </div>

      {/* Below-The-Fold Feature Section */}
      <div id="features" className="border-t border-border/40 py-24 md:py-32 bg-black/40 backdrop-blur-md px-4 sm:px-6 lg:px-8 z-10 relative scroll-mt-12">
        <div className="max-w-7xl mx-auto space-y-16">
          {/* Feature Section Header */}
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight text-foreground">
              Everything you need to manage{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-purple-400">
                AI prompts.
              </span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto mt-6 text-sm sm:text-base leading-relaxed">
              Built for developers, AI engineers, and prompt designers who need precision, performance, and version tracking.
            </p>
          </div>

          {/* 3-Column Feature Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Card 1: Version Control */}
            <div className="rounded-2xl border border-gray-800 bg-white/5 backdrop-blur-xl p-8 hover:border-purple-500/50 hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(168,85,247,0.15)] transition-all duration-300 group">
              <div className="h-12 w-12 rounded-xl bg-purple-900/20 text-purple-400 flex items-center justify-center mb-6 border border-purple-500/20 group-hover:scale-105 transition-transform">
                <GitBranch className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-300 transition-colors">
                Version Control
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Track every iteration, compare changes side-by-side, and restore previous versions instantly.
              </p>
            </div>

            {/* Card 2: AI Evaluation Engine */}
            <div className="rounded-2xl border border-gray-800 bg-white/5 backdrop-blur-xl p-8 hover:border-purple-500/50 hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(168,85,247,0.15)] transition-all duration-300 group">
              <div className="h-12 w-12 rounded-xl bg-purple-900/20 text-purple-400 flex items-center justify-center mb-6 border border-purple-500/20 group-hover:scale-105 transition-transform">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-300 transition-colors">
                AI Evaluation Engine
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Run automated evaluations to check for clarity, missing context, and expected output quality.
              </p>
            </div>

            {/* Card 3: Organized Vault */}
            <div className="rounded-2xl border border-gray-800 bg-white/5 backdrop-blur-xl p-8 hover:border-purple-500/50 hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(168,85,247,0.15)] transition-all duration-300 group">
              <div className="h-12 w-12 rounded-xl bg-purple-900/20 text-purple-400 flex items-center justify-center mb-6 border border-purple-500/20 group-hover:scale-105 transition-transform">
                <FolderLock className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-300 transition-colors">
                Organized Vault
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Categorize, tag, and search your personal prompt library with ease.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="border-t border-border/40 py-20 bg-black/40 backdrop-blur-md px-4 sm:px-6 lg:px-8 z-10 relative overflow-hidden">
        {/* Subtle Ambient Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[250px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-6xl mx-auto space-y-12 relative z-10">
          {/* Section Header */}
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight text-foreground">
              How <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-purple-400">PromptVault</span> works
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground/80 leading-relaxed font-normal">
              From creating prompts to optimizing AI workflows, manage everything in one organized workspace.
            </p>
          </div>

          {/* 3 Step Connected Workflow Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
            {/* Step 1 Card */}
            <motion.div
              whileHover={{ y: -4 }}
              className="bg-card/40 backdrop-blur-xl border border-border/60 hover:border-indigo-500/40 rounded-2xl p-6 relative hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 group space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                  <FilePlus className="h-5 w-5" />
                </div>
                <span className="font-mono text-xs font-bold text-indigo-400/80 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                  01
                </span>
              </div>
              <h3 className="text-base font-bold text-foreground group-hover:text-indigo-400 transition-colors">
                Create
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Write, save, and organize your AI prompts in a structured workspace.
              </p>
            </motion.div>

            {/* Step 2 Card */}
            <motion.div
              whileHover={{ y: -4 }}
              className="bg-card/40 backdrop-blur-xl border border-border/60 hover:border-purple-500/40 rounded-2xl p-6 relative hover:shadow-xl hover:shadow-purple-500/5 transition-all duration-300 group space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                  <GitBranch className="h-5 w-5" />
                </div>
                <span className="font-mono text-xs font-bold text-purple-400/80 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                  02
                </span>
              </div>
              <h3 className="text-base font-bold text-foreground group-hover:text-purple-400 transition-colors">
                Version
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Track every change, compare versions, and restore previous prompt iterations instantly.
              </p>
            </motion.div>

            {/* Step 3 Card */}
            <motion.div
              whileHover={{ y: -4 }}
              className="bg-card/40 backdrop-blur-xl border border-border/60 hover:border-sky-500/40 rounded-2xl p-6 relative hover:shadow-xl hover:shadow-sky-500/5 transition-all duration-300 group space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform">
                  <Sparkles className="h-5 w-5" />
                </div>
                <span className="font-mono text-xs font-bold text-sky-400/80 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
                  03
                </span>
              </div>
              <h3 className="text-base font-bold text-foreground group-hover:text-sky-400 transition-colors">
                Optimize
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Evaluate prompts with AI insights and improve output quality.
              </p>
            </motion.div>
          </div>
        </div>
      </div>

      {/* High-Fidelity App Demo Section (Diff Engine Preview) */}
      <div className="border-t border-border/40 py-24 bg-black/50 backdrop-blur-md px-4 sm:px-6 lg:px-8 z-10 relative overflow-hidden">
        {/* Ambient Glows */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-6xl mx-auto space-y-12 relative z-10">
          {/* Section Header */}
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight text-foreground">
              See the evolution of your <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-purple-400">prompts.</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground/80 leading-relaxed font-normal">
              Track changes line-by-line with our Git-inspired version control engine.
            </p>
          </div>

          {/* App Window Wrapper */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="max-w-5xl mx-auto rounded-2xl bg-card/60 backdrop-blur-2xl border border-border/80 shadow-2xl shadow-indigo-500/10 overflow-hidden relative"
          >
            {/* Window Header Bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-neutral-950/80 border-b border-border/50 select-none">
              {/* macOS Controls */}
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-rose-500/80 border border-rose-600/40" />
                <div className="h-3 w-3 rounded-full bg-amber-500/80 border border-amber-600/40" />
                <div className="h-3 w-3 rounded-full bg-emerald-500/80 border border-emerald-600/40" />
              </div>

              {/* Muted Title */}
              <div className="text-[11px] font-mono text-muted-foreground/60 flex items-center gap-2">
                <GitBranch className="h-3 w-3 text-indigo-400" />
                <span>PromptVault Editor — Version Inspection</span>
              </div>

              <div className="w-12" />
            </div>

            {/* Internal Diff Interface */}
            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 bg-black/40 font-mono text-xs">
              {/* Left Panel: v1.0 Initial Draft */}
              <div className="space-y-3 bg-neutral-950/90 rounded-xl p-4 border border-border/50">
                <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground text-xs">v1.0 - Initial Draft</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground/60">2 hours ago</span>
                </div>

                {/* Code Prompt Box */}
                <div className="p-4 rounded-lg bg-black/60 border border-border/40 leading-relaxed text-muted-foreground font-mono space-y-2">
                  <div className="text-[10px] text-indigo-400/80 uppercase tracking-wider font-bold mb-1">// System & User Prompt</div>
                  <div>
                    Write a blog post about{" "}
                    <span className="bg-rose-500/15 text-rose-300 line-through px-1.5 py-0.5 rounded font-mono border border-rose-500/30">
                      software engineering
                    </span>
                    .
                  </div>
                </div>
              </div>

              {/* Right Panel: v1.1 SEO Optimized */}
              <div className="space-y-3 bg-neutral-950/90 rounded-xl p-4 border border-emerald-500/30 ring-1 ring-emerald-500/20">
                <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground text-xs">v1.1 - SEO Optimized</span>
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[9px] px-2 py-0.5 rounded-full font-bold">
                      Current
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground/60">Just now</span>
                </div>

                {/* Code Prompt Box */}
                <div className="p-4 rounded-lg bg-black/60 border border-border/40 leading-relaxed text-muted-foreground font-mono space-y-2">
                  <div className="text-[10px] text-emerald-400/80 uppercase tracking-wider font-bold mb-1">// System & User Prompt (Diff)</div>
                  <div>
                    Write an{" "}
                    <span className="bg-emerald-500/15 text-emerald-300 px-1.5 py-0.5 rounded font-mono border border-emerald-500/30">
                      SEO-optimized
                    </span>{" "}
                    blog post{" "}
                    <span className="bg-emerald-500/15 text-emerald-300 px-1.5 py-0.5 rounded font-mono border border-emerald-500/30">
                      for developers
                    </span>{" "}
                    covering{" "}
                    <span className="bg-emerald-500/15 text-emerald-300 px-1.5 py-0.5 rounded font-mono border border-emerald-500/30">
                      data structures
                    </span>{" "}
                    and{" "}
                    <span className="bg-emerald-500/15 text-emerald-300 px-1.5 py-0.5 rounded font-mono border border-emerald-500/30">
                      object-oriented programming in C++
                    </span>
                    , including real-world examples.
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Redesigned Premium Final CTA Section */}
      <div className="border-t border-border/40 py-32 md:py-40 px-4 sm:px-6 lg:px-8 bg-black/60 relative overflow-hidden z-10">
        {/* Ambient Purple/Indigo Radial Glow behind CTA */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] sm:w-[900px] h-[400px] bg-gradient-to-tr from-purple-600/20 via-indigo-500/20 to-purple-600/15 rounded-full blur-[140px] pointer-events-none animate-pulse" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="max-w-[1100px] mx-auto rounded-3xl bg-card/40 backdrop-blur-2xl border border-border/80 p-10 sm:p-16 md:p-20 text-center space-y-8 relative overflow-hidden shadow-2xl hover:border-indigo-500/40 transition-all duration-300 group"
        >
          {/* Subtle Background Glow Accent Inside Card */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Main Headline */}
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight text-white max-w-4xl mx-auto">
            Version Control for{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-purple-400">
              AI Prompts
            </span>
          </h2>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-gray-400 max-w-[650px] mx-auto leading-relaxed font-normal">
            Track every prompt, compare versions, evaluate quality, and build reliable AI workflows with confidence.
          </p>

          {/* Buttons Row */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleStartBuildingFree}
              className="w-full sm:w-auto h-12 px-8 text-sm font-bold bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:brightness-110 text-white rounded-xl shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Start Building Free</span>
              <span className="text-base">→</span>
            </button>

            <button
              onClick={handleExploreFeatures}
              className="w-full sm:w-auto h-12 px-8 text-sm font-semibold border border-border/80 bg-secondary/20 hover:bg-secondary/60 hover:border-indigo-500/40 text-foreground rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Explore Features</span>
            </button>
          </div>

          {/* Trust Row */}
          <div className="pt-4 border-t border-border/30 max-w-2xl mx-auto flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-xs font-medium text-gray-400 select-none">
            <span className="flex items-center gap-1.5 text-emerald-400/90 font-semibold">
              <span className="text-emerald-400 font-bold">✓</span> No credit card required
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400/90 font-semibold">
              <span className="text-emerald-400 font-bold">✓</span> Free to get started
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400/90 font-semibold">
              <span className="text-emerald-400 font-bold">✓</span> Secure workspace
            </span>
          </div>

          {/* Floating Visual Element (Subtle Mini PromptVault Window Diff Preview) */}
          <div className="pt-6 max-w-2xl mx-auto opacity-35 hover:opacity-60 transition-opacity duration-300 select-none pointer-events-none">
            <div className="rounded-2xl bg-black/60 border border-border/60 p-4 font-mono text-left space-y-2 shadow-2xl text-xs">
              <div className="flex items-center justify-between border-b border-border/40 pb-2 text-[10px] text-muted-foreground/70">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-rose-500/80" />
                  <div className="h-2 w-2 rounded-full bg-amber-500/80" />
                  <div className="h-2 w-2 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 font-bold text-foreground">prompt_v1.1_seo_optimized.json</span>
                </div>
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                  🟢 AI Score: 96/100
                </span>
              </div>
              <div className="text-[11px] text-gray-300 leading-relaxed font-mono">
                <span className="text-indigo-400">+ System:</span> Act as an expert prompt engineer. Version & evaluate completions with 
                <span className="text-emerald-300 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 ml-1">zero context loss</span>.
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};
