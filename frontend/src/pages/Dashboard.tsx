import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, Search, Tag, ArrowRight, Clock, ShieldCheck, 
  MessageSquareCode, Zap, Layers, Sparkles, Filter, Trash2, X, Grid, List, AlertTriangle, ArrowRightLeft, Pin, FlaskConical, ChevronDown, ChevronRight, Loader2, GitCommit
} from "lucide-react";
import { blueprintApi, dashboardApi, compareApi, Blueprint, DashboardStats, ActivityLog, RegressionDetail, ComparisonHistoryItem } from "../services/api";
import { formatLocalTimestamp, formatRelativeOrLocalTimestamp } from "../utils/date";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Input, Label, Textarea } from "../components/ui/Input";
import { DeleteBlueprintModal } from "../components/DeleteBlueprintModal";
import { useAuth } from "../context/AuthContext";
import { PROMPTVAULT_EXTENSION_STORE_URL } from "../config";

const getActivityMeta = (eventType: string) => {
  const t = (eventType || "").toLowerCase();
  if (t.includes("regression")) {
    return { color: "text-amber-400", icon: AlertTriangle };
  }
  if (t.includes("evaluation") || t.includes("score")) {
    return { color: "text-emerald-400", icon: Sparkles };
  }
  if (t.includes("version")) {
    return { color: "text-purple-400", icon: Layers };
  }
  if (t.includes("compared") || t.includes("compare")) {
    return { color: "text-sky-400", icon: ArrowRightLeft };
  }
  return { color: "text-indigo-400", icon: Clock };
};

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const isAuthenticated = Boolean(user);
  
  // States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  
  // Persistent Grid/List View Layout State
  const [isGridView, setIsGridView] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("promptvault_layout_preference");
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const toggleLayoutView = (isGrid: boolean) => {
    setIsGridView(isGrid);
    try {
      localStorage.setItem("promptvault_layout_preference", JSON.stringify(isGrid));
    } catch {}
  };
  
  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBpName, setNewBpName] = useState("");
  const [newBpDesc, setNewBpDesc] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  const handleOpenCreateModal = () => {
    setNewBpName("");
    setNewBpDesc("");
    setNameError(null);
    setShowCreateModal(true);
  };

  const handleCloseCreateModal = () => {
    setNewBpName("");
    setNewBpDesc("");
    setNameError(null);
    setShowCreateModal(false);
  };

  // Extension Installation & Connection States
  const [isExtensionConnected, setIsExtensionConnected] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return (
        (window as any).__pvExtensionConnected === true ||
        document.documentElement.getAttribute("data-pv-extension-connected") === "true"
      );
    }
    return false;
  });

  const [isExtensionInstalled, setIsExtensionInstalled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return (
        (window as any).__pvExtensionInstalled === true ||
        document.documentElement.getAttribute("data-pv-extension-installed") === "true"
      );
    }
    return false;
  });

  const [isExtensionCardDismissed, setIsExtensionCardDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("pv_extension_dismissed") === "true";
    } catch {
      return false;
    }
  });

  const [showConnectedState, setShowConnectedState] = useState<boolean>(false);

  React.useEffect(() => {
    const handleStatus = (e: any) => {
      const conn = e.detail?.connected ?? false;
      const inst = e.detail?.installed ?? true;
      setIsExtensionInstalled(inst);
      if (conn && !isExtensionConnected) {
        setShowConnectedState(true);
      }
      setIsExtensionConnected(conn);
    };

    const handleDetected = () => setIsExtensionInstalled(true);

    window.addEventListener("pv-extension-status", handleStatus);
    window.addEventListener("pv-extension-detected", handleDetected);
    return () => {
      window.removeEventListener("pv-extension-status", handleStatus);
      window.removeEventListener("pv-extension-detected", handleDetected);
    };
  }, [isExtensionConnected]);

  const handleDismissExtensionCard = () => {
    setIsExtensionCardDismissed(true);
    setShowConnectedState(false);
    try {
      localStorage.setItem("pv_extension_dismissed", "true");
    } catch {}
  };

  const handleDownloadExtension = () => {
    window.open(PROMPTVAULT_EXTENSION_STORE_URL, "_blank");
  };

  // Regressions Modal State
  const [showRegressionsModal, setShowRegressionsModal] = useState(false);
  
  // Clear Logs Modal State
  const [showClearLogsModal, setShowClearLogsModal] = useState(false);

  // Comparison History Modal States
  const [showCompHistoryModal, setShowCompHistoryModal] = useState(false);
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false);
  
  // Custom toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Queries — Strictly gated on authentication state
  const { data: blueprints = [], isLoading: isLoadingBlueprints, isError } = useQuery<Blueprint[]>({
    queryKey: ["blueprints"],
    queryFn: blueprintApi.list,
    enabled: isAuthenticated && !authLoading,
  });

  const { data: compHistory = [], isLoading: isLoadingCompHistory } = useQuery<ComparisonHistoryItem[]>({
    queryKey: ["comparison-history"],
    queryFn: compareApi.getHistory,
    enabled: isAuthenticated && !authLoading && showCompHistoryModal,
  });

  const clearCompHistoryMutation = useMutation({
    mutationFn: compareApi.clearHistory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comparison-history"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setShowClearHistoryConfirm(false);
      triggerToast("✓ Comparison history cleared");
    },
    onError: (err: any) => {
      triggerToast(err?.response?.data?.detail || "Failed to clear comparison history");
    }
  });

  // Collapsible Pinned Section State
  const [isPinnedExpanded, setIsPinnedExpanded] = useState<boolean>(false);
  const hasAutoSetPinnedExpanded = React.useRef(false);

  React.useEffect(() => {
    if (!isLoadingBlueprints && blueprints.length > 0 && !hasAutoSetPinnedExpanded.current) {
      const hasPinned = blueprints.some(bp => bp.is_pinned);
      setIsPinnedExpanded(hasPinned);
      hasAutoSetPinnedExpanded.current = true;
    }
  }, [isLoadingBlueprints, blueprints]);

  // Compute if entered name is duplicate (case-insensitive & trimmed)
  const isDuplicateName = React.useMemo(() => {
    const trimmed = newBpName.trim().toLowerCase();
    if (!trimmed) return false;
    return blueprints.some(bp => bp.name.trim().toLowerCase() === trimmed);
  }, [newBpName, blueprints]);

  const { data: stats, isLoading: isLoadingStats } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: dashboardApi.getStats,
    enabled: isAuthenticated && !authLoading,
  });

  const { data: activities = [], isLoading: isLoadingActivities } = useQuery<ActivityLog[]>({
    queryKey: ["dashboard-activities"],
    queryFn: dashboardApi.getActivities,
    enabled: isAuthenticated && !authLoading,
  });

  const { data: regressions = [], isLoading: isLoadingRegressions } = useQuery<RegressionDetail[]>({
    queryKey: ["dashboard-regressions"],
    queryFn: dashboardApi.getRegressions,
    enabled: isAuthenticated && !authLoading,
  });

  const isDataLoading = isLoadingBlueprints || isLoadingStats || isLoadingActivities || isLoadingRegressions;

  React.useEffect(() => {
    if (!isLoadingBlueprints && blueprints.length > 0 && !hasAutoSetPinnedExpanded.current) {
      const hasPinned = blueprints.some(bp => bp.is_pinned);
      setIsPinnedExpanded(hasPinned);
      hasAutoSetPinnedExpanded.current = true;
    }
  }, [isLoadingBlueprints, blueprints]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: blueprintApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["blueprints"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-activities"] });
      setShowCreateModal(false);
      setNewBpName("");
      setNewBpDesc("");
      setNameError(null);
      triggerToast(`Blueprint "${data.name}" created successfully!`);
      navigate(`/editor?id=${data.id}`);
    },
    onError: (err: any) => {
      if (err?.response?.status === 409 || err?.response?.data?.detail?.includes("already exists")) {
        setNameError("This blueprint name already exists.");
        triggerToast("Blueprint already exists. Please choose a different name.");
      } else {
        triggerToast(err?.response?.data?.detail || "Failed to create blueprint");
      }
    }
  });

  // Delete Blueprint Modal State
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const deleteMutation = useMutation({
    mutationFn: blueprintApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blueprints"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-activities"] });
      setDeleteTarget(null);
      triggerToast("Blueprint deleted successfully.");
    },
    onError: (err: any) => {
      triggerToast(err?.response?.data?.detail || "Failed to delete blueprint");
    }
  });

  const togglePinMutation = useMutation({
    mutationFn: blueprintApi.togglePin,
    onMutate: async (bpId: number) => {
      // Cancel outgoing refetches so they don't overwrite optimistic update
      await queryClient.cancelQueries({ queryKey: ["blueprints"] });

      // Snapshot previous value
      const previousBlueprints = queryClient.getQueryData<Blueprint[]>(["blueprints"]);

      // Target blueprint details
      const targetBp = previousBlueprints?.find((bp) => bp.id === bpId);
      const isCurrentlyPinned = targetBp?.is_pinned ?? false;

      // Auto-expand Pinned section if user is pinning a blueprint
      if (!isCurrentlyPinned && !isPinnedExpanded) {
        setIsPinnedExpanded(true);
      }

      // Optimistically update React Query cache immediately
      queryClient.setQueryData<Blueprint[]>(["blueprints"], (old = []) =>
        old.map((bp) => (bp.id === bpId ? { ...bp, is_pinned: !bp.is_pinned } : bp))
      );

      return { previousBlueprints };
    },
    onSuccess: (updated) => {
      // Direct cache update with server response without triggering full refetch
      queryClient.setQueryData<Blueprint[]>(["blueprints"], (old = []) =>
        old.map((bp) => (bp.id === updated.id ? { ...bp, ...updated } : bp))
      );
      // Quietly invalidate background stats and activity logs
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-activities"] });

      if (updated.is_pinned) {
        triggerToast("Blueprint pinned successfully.");
      } else {
        triggerToast("Blueprint removed from favorites.");
      }
    },
    onError: (err: any, _bpId, context) => {
      // Rollback cache to previous snapshot on failure
      if (context?.previousBlueprints) {
        queryClient.setQueryData(["blueprints"], context.previousBlueprints);
      }
      triggerToast(err?.response?.data?.detail || "Failed to update pin status.");
    }
  });

  const clearLogsMutation = useMutation({
    mutationFn: dashboardApi.clearActivities,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-activities"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setShowClearLogsModal(false);
      triggerToast("Activity logs cleared successfully.");
    },
    onError: (err: any) => {
      triggerToast(err?.response?.data?.detail || "Failed to clear activity logs.");
    }
  });

  const clearRegressionMutation = useMutation({
    mutationFn: (id: number) => dashboardApi.clearRegression(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-regressions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-activities"] });
      triggerToast("Regression warning cleared.");
    },
    onError: (err: any) => {
      triggerToast(err?.response?.data?.detail || "Failed to clear warning.");
    }
  });

  const clearAllRegressionsMutation = useMutation({
    mutationFn: () => dashboardApi.clearAllRegressions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-regressions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-activities"] });
      triggerToast("All regression warnings cleared.");
    },
    onError: (err: any) => {
      triggerToast(err?.response?.data?.detail || "Failed to clear all warnings.");
    }
  });

  const handleTogglePin = (e: React.MouseEvent, bpId: number) => {
    e.stopPropagation();
    togglePinMutation.mutate(bpId);
  };

  const handleCreateBlueprint = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newBpName.trim();
    if (!trimmed) return;

    if (isDuplicateName) {
      setNameError("This blueprint name already exists.");
      triggerToast("Blueprint already exists. Please choose a different name.");
      return;
    }

    setNameError(null);
    createMutation.mutate({
      name: trimmed,
      description: newBpDesc
    });
  };

  const handleDeleteBlueprint = (e: React.MouseEvent, id: number, name: string) => {
    e.stopPropagation(); // Avoid navigating to the editor
    setDeleteTarget({ id, name });
  };

  // Extract static mock tags
  const defaultTags = ["support", "classification", "coding", "marketing", "rag"];

  const filteredBlueprints = blueprints.filter((bp) => {
    const matchesSearch = 
      bp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (bp.description || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTag = selectedTag 
      ? bp.name.toLowerCase().includes(selectedTag) || (bp.description || "").toLowerCase().includes(selectedTag)
      : true;
      
    return matchesSearch && matchesTag;
  });

  const pinnedBlueprints = React.useMemo(() => {
    return filteredBlueprints.filter((bp: Blueprint) => bp.is_pinned);
  }, [filteredBlueprints]);

  const unpinnedBlueprints = React.useMemo(() => {
    return filteredBlueprints.filter((bp: Blueprint) => !bp.is_pinned);
  }, [filteredBlueprints]);

  const totalBlueprints = stats?.total_blueprints ?? blueprints.length;
  const totalVersions = stats?.total_versions ?? blueprints.reduce((acc, curr) => acc + (curr.version_count || 0), 0);
  const totalTestCases = stats?.total_test_cases ?? 0;
  const totalComparisons = stats?.total_comparisons ?? 0;
  const regressionWarnings = stats?.regression_warnings ?? 0;
  const averageAiScore = stats?.average_ai_score;

  const getActivityMeta = (eventType: string) => {
    switch (eventType) {
      case "Blueprint Created":
        return { color: "text-indigo-400", icon: Plus };
      case "Blueprint Deleted":
        return { color: "text-rose-500", icon: Trash2 };
      case "Version Saved":
        return { color: "text-purple-400", icon: Tag };
      case "Version Deleted":
        return { color: "text-neutral-500", icon: Trash2 };
      case "Test Case Added":
        return { color: "text-emerald-400", icon: MessageSquareCode };
      case "Test Case Deleted":
        return { color: "text-neutral-500", icon: Trash2 };
      case "Prompt Compared":
        return { color: "text-sky-400", icon: ArrowRightLeft };
      case "AI Evaluation Completed":
        return { color: "text-amber-400", icon: Sparkles };
      case "Regression Detected":
        return { color: "text-rose-500", icon: AlertTriangle };
      default:
        return { color: "text-muted-foreground", icon: Clock };
    }
  };

  // ── Strict Authentication Protection Gate ────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] select-none">
        <Loader2 className="h-6 w-6 animate-spin text-primary mb-3" />
        <span className="text-xs text-muted-foreground font-mono">Verifying session...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] py-16 text-center select-none">
        <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-5 shadow-lg shadow-indigo-500/5">
          <img src="/pv-logo.png" alt="PromptVault Logo" className="w-12 h-12 object-contain" />
        </div>
        <h2 className="text-xl font-extrabold text-foreground tracking-tight">Authentication Required</h2>
        <p className="text-xs text-muted-foreground/80 mt-1.5 max-w-sm leading-relaxed">
          Please sign in to access your prompt blueprints, version trees, and evaluations.
        </p>
        <Button
          onClick={() => navigate("/login")}
          className="mt-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold h-10 px-6 text-xs shadow-lg shadow-purple-600/30 hover:shadow-purple-600/50 transition-all duration-200 cursor-pointer"
        >
          Login / Sign Up
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-8 relative"
    >
      {/* Toast Alert Box */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 right-6 z-50 bg-neutral-900 border border-neutral-800 text-white px-4 py-2.5 rounded-lg shadow-xl text-xs flex items-center gap-2"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Heading Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/20 pb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gradient">Prompt Blueprints</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Author, track versions, and compare LLM completion evaluations.</p>
        </div>
        <div className="flex items-center gap-2.5">
          {/* Layout view toggler */}
          <div className="flex items-center gap-1 bg-secondary/20 p-1 rounded-lg border border-border/50">
            <button
              onClick={() => toggleLayoutView(true)}
              className={`p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-all ${
                isGridView ? "bg-card text-foreground shadow-sm" : ""
              }`}
              title="Grid view"
            >
              <Grid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => toggleLayoutView(false)}
              className={`p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-all ${
                !isGridView ? "bg-card text-foreground shadow-sm" : ""
              }`}
              title="List view"
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
          <Button 
            onClick={handleOpenCreateModal} 
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 hover:brightness-110 text-primary-foreground font-bold h-9 px-4 shadow-md hover:shadow-[0_0_20px_rgba(99,102,241,0.45)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200 ease-out cursor-pointer"
          >
            <Plus className="h-4 w-4" strokeWidth={2.2} />
            <span>Create Blueprint</span>
          </Button>
        </div>
      </div>

      {/* Post-Login Extension Installation & Connection Banner */}
      <AnimatePresence>
        {!isExtensionCardDismissed && (!isExtensionConnected || showConnectedState) && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="p-5 rounded-2xl glass-card border border-purple-500/30 bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-background shadow-lg shadow-purple-950/20 relative overflow-hidden my-4"
          >
            {isExtensionConnected ? (
              /* State B: Connected */
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 shrink-0 flex items-center justify-center">
                    <img src="/pv-logo.png" alt="PromptVault Logo" className="w-8 h-8 object-contain" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-emerald-400 tracking-tight flex items-center gap-2">
                      ✓ You're all set!
                    </h3>
                    <p className="text-xs text-purple-200/80 mt-1 max-w-xl leading-relaxed">
                      PromptVault is connected and ready. Save your prompts directly from ChatGPT, Claude, Gemini and more.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto shrink-0">
                  <Button
                    onClick={handleDismissExtensionCard}
                    className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold h-9 px-4 text-xs shadow-md shadow-emerald-600/30 hover:shadow-emerald-600/50 transition-all duration-200 cursor-pointer"
                  >
                    Start Saving Prompts
                  </Button>
                </div>
              </div>
            ) : (
              /* State A: Not Connected / Download */
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 shrink-0 flex items-center justify-center">
                    <img src="/pv-logo.png" alt="PromptVault Logo" className="w-8 h-8 object-contain" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-white tracking-tight flex items-center gap-2">
                      Save prompts from anywhere
                    </h3>
                    <p className="text-xs text-purple-200/70 mt-1 max-w-xl leading-relaxed">
                      Download the PromptVault extension to save prompts from ChatGPT, Claude, Gemini and more in one click.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto shrink-0">
                  <Button
                    onClick={handleDownloadExtension}
                    className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold h-9 px-4 text-xs shadow-md shadow-purple-600/30 hover:shadow-purple-600/50 transition-all duration-200 cursor-pointer"
                  >
                    Download PromptVault Extension
                  </Button>
                  <button
                    onClick={handleDismissExtensionCard}
                    className="text-xs text-purple-300/60 hover:text-purple-200 font-medium px-2 py-1 transition-colors cursor-pointer"
                  >
                    Maybe later
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skeletons Loader */}
      {isLoadingBlueprints ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-secondary/10 rounded-xl border border-border/40 animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-4">
              <div className="h-10 bg-secondary/10 rounded-lg animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-36 bg-secondary/10 rounded-xl border border-border/40 animate-pulse" />
                ))}
              </div>
            </div>
            <div className="h-96 bg-secondary/10 rounded-xl border border-border/40 animate-pulse" />
          </div>
        </div>
      ) : isError ? (
        <div className="text-center py-12 border border-dashed border-red-500/20 rounded-xl bg-red-500/5">
          <span className="text-red-500 text-xs font-semibold">Failed to fetch blueprints database. Run uvicorn server.</span>
        </div>
      ) : (
        <>
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 select-none">
            <Card className="glass-card hover:-translate-y-0.5 hover:border-indigo-500/30 hover:shadow-md hover:shadow-indigo-500/5 transition-all duration-200 cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Blueprints</span>
                  <MessageSquareCode className="h-4 w-4 text-indigo-400" strokeWidth={2} />
                </div>
                <div className="mt-2 text-2xl font-black">{totalBlueprints}</div>
              </CardContent>
            </Card>

            <Card className="glass-card hover:-translate-y-0.5 hover:border-indigo-500/30 hover:shadow-md hover:shadow-indigo-500/5 transition-all duration-200 cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Version Nodes</span>
                  <Layers className="h-4 w-4 text-purple-400" strokeWidth={2} />
                </div>
                <div className="mt-2 text-2xl font-black">{totalVersions}</div>
              </CardContent>
            </Card>

            <Card 
              className="glass-card hover:-translate-y-0.5 hover:border-sky-500/40 hover:shadow-md hover:shadow-sky-500/5 transition-all duration-200 cursor-pointer"
              onClick={() => setShowCompHistoryModal(true)}
              title="Click to view comparison history"
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Comparisons Run</span>
                  <ArrowRightLeft className="h-4 w-4 text-sky-400" strokeWidth={2} />
                </div>
                <div className="mt-2 text-2xl font-black">{totalComparisons}</div>
              </CardContent>
            </Card>

            <Card 
              className="glass-card cursor-pointer hover:-translate-y-0.5 hover:border-rose-500/40 hover:shadow-md hover:shadow-rose-500/5 transition-all duration-200" 
              onClick={() => setShowRegressionsModal(true)}
              title="Click to view regression details"
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Regression Warnings</span>
                  <AlertTriangle className="h-4 w-4 text-rose-500" strokeWidth={2} />
                </div>
                <div className="mt-2 text-sm font-bold flex items-center gap-1.5 text-rose-450 leading-relaxed min-h-[32px]">
                  {regressionWarnings === 0 ? (
                    <span className="text-emerald-400 font-sans">✅ No regressions</span>
                  ) : (
                    <span className="text-rose-450 font-sans">⚠ {regressionWarnings} warning{regressionWarnings > 1 ? "s" : ""}</span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card hover:-translate-y-0.5 hover:border-indigo-500/30 hover:shadow-md hover:shadow-indigo-500/5 transition-all duration-200 cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Avg AI Score</span>
                  <Sparkles className="h-4 w-4 text-amber-400" strokeWidth={2} />
                </div>
                <div className="mt-2 text-2xl font-black text-gradient">
                  {averageAiScore !== null && averageAiScore !== undefined ? (
                    `${averageAiScore}%`
                  ) : (
                    <span className="text-xs text-slate-300 dark:text-zinc-300 font-sans font-medium normal-case">No evaluations yet.</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Grid: list & activity */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Blueprints Display Section */}
            <div className="xl:col-span-2 space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-3 select-none">
                {/* Search */}
                <div className="relative w-full">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} />
                  <Input
                    placeholder="Search prompt blueprints..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 text-xs"
                  />
                </div>
                
                {/* Tag Filters */}
                <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0 overflow-x-auto py-1">
                  <Filter className="h-3 w-3 text-muted-foreground shrink-0" strokeWidth={2} />
                  <Button
                    variant={selectedTag === null ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setSelectedTag(null)}
                    className="text-[10px] py-1 h-7 shrink-0 font-bold hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 cursor-pointer"
                  >
                    ALL
                  </Button>
                  {defaultTags.map((tag) => (
                    <Button
                      key={tag}
                      variant={selectedTag === tag ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setSelectedTag(tag)}
                      className="text-[10px] py-1 h-7 shrink-0 flex items-center gap-1 font-bold hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 cursor-pointer"
                    >
                      <Tag className="h-2.5 w-2.5" strokeWidth={2} />
                      {tag.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Pinned & Unpinned Blueprints Display */}
              {filteredBlueprints.length > 0 ? (
                <div className="space-y-6">
                  {/* Lightweight Contextual Summary Line */}
                  <div className="text-[11px] font-medium text-muted-foreground/80 font-mono select-none flex items-center gap-1.5 pb-1">
                    <Layers className="h-3.5 w-3.5 text-indigo-400/80 shrink-0" strokeWidth={2} />
                    <span>Blueprints • Total: {filteredBlueprints.length}</span>
                  </div>

                  {/* ⭐ Pinned Blueprints Collapsible Section */}
                  <div className="space-y-3 font-sans select-none">
                    <div 
                      className="flex items-center justify-between border-b border-border/40 pb-2 cursor-pointer group"
                      onClick={() => setIsPinnedExpanded(prev => !prev)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                          ⭐ Pinned Blueprints
                        </span>
                        <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-400 font-mono py-0 font-bold">
                          {pinnedBlueprints.length}
                        </Badge>
                      </div>
                      <button 
                        type="button"
                        className="text-[11px] font-medium text-muted-foreground hover:text-amber-400 flex items-center gap-1.5 transition-all duration-150 px-2 py-0.5 rounded bg-secondary/20 hover:bg-secondary/50 border border-border/40 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsPinnedExpanded(prev => !prev);
                        }}
                      >
                        {isPinnedExpanded ? (
                          <>
                            <ChevronDown className="h-3 w-3 text-amber-400" strokeWidth={2} />
                            <span>Hide Pinned Blueprints</span>
                          </>
                        ) : (
                          <>
                            <ChevronRight className="h-3 w-3 text-amber-400" strokeWidth={2} />
                            <span>Show Pinned Blueprints</span>
                          </>
                        )}
                      </button>
                    </div>

                    <AnimatePresence initial={false}>
                      {isPinnedExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: "easeInOut" }}
                          className="overflow-hidden space-y-3 pt-1"
                        >
                          {pinnedBlueprints.length > 0 ? (
                            isGridView ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {pinnedBlueprints.map(bp => (
                                  <Card 
                                    key={bp.id} 
                                    className="glass-card hover:-translate-y-1 hover:shadow-lg hover:shadow-amber-500/10 cursor-pointer flex flex-col justify-between group transition-all duration-200 border-amber-500/40 bg-amber-500/5 ring-1 ring-amber-500/20"
                                    onClick={() => navigate(`/editor?id=${bp.id}`)}
                                  >
                                    <CardHeader className="pb-3.5 pt-4 px-5">
                                      {/* Top Bar: Blueprint ID + Pin & Delete Actions */}
                                      <div className="flex items-center justify-between gap-2 select-none mb-1.5">
                                        <span className="text-[9.5px] font-mono text-muted-foreground/60 tracking-wider font-semibold uppercase">
                                          ID #{bp.id}
                                        </span>
                                        <div className="flex items-center gap-1">
                                          <button
                                            disabled={togglePinMutation.isPending && togglePinMutation.variables === bp.id}
                                            onClick={(e) => handleTogglePin(e, bp.id)}
                                            className="h-6.5 w-6.5 rounded-md flex items-center justify-center transition-all bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Unpin Blueprint"
                                          >
                                            {togglePinMutation.isPending && togglePinMutation.variables === bp.id ? (
                                              <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
                                            ) : (
                                              <Pin className="h-3 w-3 fill-amber-400 text-amber-400" strokeWidth={2} />
                                            )}
                                          </button>
                                          <button
                                            onClick={(e) => handleDeleteBlueprint(e, bp.id, bp.name)}
                                            className="opacity-0 group-hover:opacity-100 h-6.5 w-6.5 rounded-md bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 flex items-center justify-center transition-all cursor-pointer"
                                            title="Delete Blueprint"
                                          >
                                            <Trash2 className="h-3 w-3" strokeWidth={2} />
                                          </button>
                                        </div>
                                      </div>

                                      {/* Title: Highest Visual Priority */}
                                      <CardTitle className="text-[17px] font-black tracking-tight text-foreground group-hover:text-indigo-400 transition-colors leading-snug mt-2 mb-2">
                                        {bp.name}
                                      </CardTitle>

                                      {/* Description */}
                                      {bp.description?.trim() && (
                                        <CardDescription className="line-clamp-2 mt-1 text-xs text-muted-foreground/70 leading-relaxed font-sans overflow-hidden text-ellipsis">
                                          {bp.description}
                                        </CardDescription>
                                      )}

                                      {/* Quick Stats 2x2 Grid */}
                                      <div className="mt-4 pt-3.5 border-t border-border/40 grid grid-cols-2 gap-2 text-xs font-sans select-none">
                                        <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/20 border border-border/30">
                                          <span className="text-[10px] text-muted-foreground flex items-center gap-1.5 font-semibold">
                                            <Layers className="h-3.5 w-3.5 text-purple-400" strokeWidth={2} /> Versions
                                          </span>
                                          <span className="font-extrabold font-mono text-xs text-foreground">{bp.version_count ?? 0}</span>
                                        </div>

                                        <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/20 border border-border/30">
                                          <span className="text-[10px] text-muted-foreground flex items-center gap-1.5 font-semibold">
                                            <FlaskConical className="h-3.5 w-3.5 text-sky-400" strokeWidth={2} /> Test Cases
                                          </span>
                                          <span className="font-extrabold font-mono text-xs text-foreground">{bp.test_case_count ?? 0}</span>
                                        </div>

                                        <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/20 border border-border/30">
                                          <span className="text-[10px] text-muted-foreground flex items-center gap-1.5 font-semibold">
                                            <Sparkles className="h-3.5 w-3.5 text-amber-400" strokeWidth={2} /> AI Score
                                          </span>
                                          {bp.average_ai_score != null ? (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                              🟢 {bp.average_ai_score}/100
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                              🟡 Not Evaluated
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/20 border border-border/30">
                                          <span className="text-[10px] text-muted-foreground flex items-center gap-1.5 font-semibold">
                                            <Clock className="h-3.5 w-3.5 text-indigo-400" strokeWidth={2} /> Updated
                                          </span>
                                          <span className="font-bold text-[10px] text-foreground truncate max-w-[85px]" title={formatRelativeOrLocalTimestamp(bp.last_updated)}>
                                            {formatRelativeOrLocalTimestamp(bp.last_updated)}
                                          </span>
                                        </div>
                                      </div>
                                    </CardHeader>
                                    <div className="px-5 py-2.5 border-t border-border/40 bg-secondary/15 flex items-center justify-between rounded-b-xl select-none">
                                      <div className="flex items-center gap-2 group/btn cursor-pointer">
                                        <span className="text-xs font-bold text-indigo-400 group-hover/btn:text-indigo-300 transition-colors flex items-center gap-1">
                                          Blueprint Workspace
                                          <ArrowRight className="h-3.5 w-3.5 text-indigo-400 group-hover/btn:translate-x-1 transition-transform" strokeWidth={2} />
                                        </span>
                                        {bp.forked_from && (
                                          <Badge variant="outline" className="text-[8px] border-indigo-500/30 text-indigo-400 font-mono py-0">FORKED</Badge>
                                        )}
                                      </div>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-[11px] px-3 font-bold bg-secondary/40 hover:bg-secondary/80 text-foreground border-border/60 hover:border-border transition-all hover:-translate-y-0.5 active:translate-y-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigate(`/compare?id=${bp.id}`);
                                        }}
                                      >
                                        Compare →
                                      </Button>
                                    </div>
                                  </Card>
                                ))}
                              </div>
                            ) : (
                              <div className="border border-amber-500/30 bg-amber-500/5 backdrop-blur-md rounded-xl divide-y divide-border/50 overflow-hidden">
                                {pinnedBlueprints.map(bp => (
                                  <div
                                    key={bp.id}
                                    onClick={() => navigate(`/editor?id=${bp.id}`)}
                                    className="group flex flex-col md:flex-row md:items-center justify-between p-4 hover:bg-secondary/20 cursor-pointer transition-all duration-150 gap-4 bg-amber-500/5"
                                  >
                                    <div className="flex items-center gap-3.5 min-w-0">
                                      <button
                                        disabled={togglePinMutation.isPending && togglePinMutation.variables === bp.id}
                                        onClick={(e) => handleTogglePin(e, bp.id)}
                                        className="h-7 w-7 rounded-lg flex items-center justify-center border transition-all bg-amber-500/20 text-amber-400 border-amber-500/40 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Unpin Blueprint"
                                      >
                                        {togglePinMutation.isPending && togglePinMutation.variables === bp.id ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
                                        ) : (
                                          <Pin className="h-3.5 w-3.5 fill-amber-400 text-amber-400" strokeWidth={2} />
                                        )}
                                      </button>
                                      <div className="truncate space-y-0.5">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[9.5px] font-mono text-muted-foreground/60 tracking-wider font-semibold uppercase">
                                            ID #{bp.id}
                                          </span>
                                          <span className="text-[15px] font-black text-foreground group-hover:text-indigo-400 transition-colors">
                                            {bp.name}
                                          </span>
                                          <Badge variant="outline" className="text-[8px] border-amber-500/40 text-amber-400 font-mono py-0 font-bold">
                                            PINNED
                                          </Badge>
                                          {bp.forked_from && (
                                            <Badge variant="outline" className="text-[8px] border-indigo-500/30 text-indigo-400 font-mono py-0">FORKED</Badge>
                                          )}
                                        </div>
                                        {bp.description?.trim() && (
                                          <span className="text-[11.5px] text-muted-foreground/70 truncate block max-w-md font-sans">
                                            {bp.description}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-4 shrink-0 select-none text-xs font-sans">
                                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground border-r border-border/50 pr-4">
                                        <span title="Versions" className="flex items-center gap-1 font-mono font-semibold">
                                          <Layers className="h-3 w-3 text-purple-400" strokeWidth={2} /> {bp.version_count ?? 0} ver
                                        </span>
                                        <span title="Test Cases" className="flex items-center gap-1 font-mono font-semibold">
                                          <FlaskConical className="h-3 w-3 text-sky-400" strokeWidth={2} /> {bp.test_case_count ?? 0} tests
                                        </span>
                                        <span title="Average AI Score" className="flex items-center gap-1">
                                          {bp.average_ai_score != null ? (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                              🟢 {bp.average_ai_score}/100
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                              🟡 Not Evaluated
                                            </span>
                                          )}
                                        </span>
                                        <span title="Last Updated" className="flex items-center gap-1 text-[10px] text-foreground font-medium">
                                          <Clock className="h-3 w-3 text-indigo-400" strokeWidth={2} /> {formatRelativeOrLocalTimestamp(bp.last_updated)}
                                        </span>
                                      </div>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-[11px] px-3 font-bold bg-secondary/40 hover:bg-secondary/80 text-foreground border-border/60 hover:border-border transition-all hover:-translate-y-0.5 active:translate-y-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigate(`/compare?id=${bp.id}`);
                                        }}
                                      >
                                        Compare →
                                      </Button>
                                      <button
                                        onClick={(e) => handleDeleteBlueprint(e, bp.id, bp.name)}
                                        className="opacity-0 group-hover:opacity-100 h-6 w-6 rounded bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 flex items-center justify-center transition-all cursor-pointer"
                                        title="Delete Blueprint"
                                      >
                                        <Trash2 className="h-3 w-3" strokeWidth={2} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )
                          ) : (
                            <div className="p-4 border border-dashed border-border/60 rounded-xl bg-card/10 text-center text-xs text-muted-foreground font-sans">
                              No pinned blueprints yet.
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* 📁 Other Blueprints Section */}
                  <div className="space-y-3 pt-2 font-sans select-none">
                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        📁 Other Blueprints
                      </span>
                      <Badge variant="outline" className="text-[9px] border-border text-muted-foreground font-mono py-0 font-bold">
                        {unpinnedBlueprints.length}
                      </Badge>
                    </div>

                    {unpinnedBlueprints.length > 0 ? (
                      isGridView ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {unpinnedBlueprints.map(bp => (
                            <Card 
                              key={bp.id} 
                              className="glass-card hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-500/10 hover:border-indigo-500/40 cursor-pointer flex flex-col justify-between group transition-all duration-200"
                              onClick={() => navigate(`/editor?id=${bp.id}`)}
                            >
                              <CardHeader className="pb-3.5 pt-4 px-5">
                                {/* Top Bar: Blueprint ID + Pin & Delete Actions */}
                                <div className="flex items-center justify-between gap-2 select-none mb-1.5">
                                  <span className="text-[9.5px] font-mono text-muted-foreground/60 tracking-wider font-semibold uppercase">
                                    ID #{bp.id}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      disabled={togglePinMutation.isPending && togglePinMutation.variables === bp.id}
                                      onClick={(e) => handleTogglePin(e, bp.id)}
                                      className="opacity-60 hover:opacity-100 hover:bg-secondary/50 h-6.5 w-6.5 rounded-md text-muted-foreground hover:text-amber-400 flex items-center justify-center transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="Pin Blueprint"
                                    >
                                      {togglePinMutation.isPending && togglePinMutation.variables === bp.id ? (
                                        <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
                                      ) : (
                                        <Pin className="h-3 w-3" strokeWidth={2} />
                                      )}
                                    </button>
                                    <button
                                      onClick={(e) => handleDeleteBlueprint(e, bp.id, bp.name)}
                                      className="opacity-0 group-hover:opacity-100 h-6.5 w-6.5 rounded-md bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 flex items-center justify-center transition-all cursor-pointer"
                                      title="Delete Blueprint"
                                    >
                                      <Trash2 className="h-3 w-3" strokeWidth={2} />
                                    </button>
                                  </div>
                                </div>

                                {/* Title: Highest Visual Priority */}
                                <CardTitle className="text-[17px] font-black tracking-tight text-foreground group-hover:text-indigo-400 transition-colors leading-snug mt-2 mb-2">
                                  {bp.name}
                                </CardTitle>

                                {/* Description */}
                                {bp.description?.trim() && (
                                  <CardDescription className="line-clamp-2 mt-1 text-xs text-muted-foreground/70 leading-relaxed font-sans overflow-hidden text-ellipsis">
                                    {bp.description}
                                  </CardDescription>
                                )}

                                {/* Quick Stats 2x2 Grid */}
                                <div className="mt-4 pt-3.5 border-t border-border/40 grid grid-cols-2 gap-2 text-xs font-sans select-none">
                                  <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/20 border border-border/30">
                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1.5 font-semibold">
                                      <Layers className="h-3.5 w-3.5 text-purple-400" strokeWidth={2} /> Versions
                                    </span>
                                    <span className="font-extrabold font-mono text-xs text-foreground">{bp.version_count ?? 0}</span>
                                  </div>

                                  <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/20 border border-border/30">
                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1.5 font-semibold">
                                      <FlaskConical className="h-3.5 w-3.5 text-sky-400" strokeWidth={2} /> Test Cases
                                    </span>
                                    <span className="font-extrabold font-mono text-xs text-foreground">{bp.test_case_count ?? 0}</span>
                                  </div>

                                  <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/20 border border-border/30">
                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1.5 font-semibold">
                                      <Sparkles className="h-3.5 w-3.5 text-amber-400" strokeWidth={2} /> AI Score
                                    </span>
                                    {bp.average_ai_score != null ? (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                        🟢 {bp.average_ai_score}/100
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                        🟡 Not Evaluated
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/20 border border-border/30">
                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1.5 font-semibold">
                                      <Clock className="h-3.5 w-3.5 text-indigo-400" strokeWidth={2} /> Updated
                                    </span>
                                    <span className="font-bold text-[10px] text-foreground truncate max-w-[85px]" title={formatRelativeOrLocalTimestamp(bp.last_updated)}>
                                      {formatRelativeOrLocalTimestamp(bp.last_updated)}
                                    </span>
                                  </div>
                                </div>
                              </CardHeader>
                              <div className="px-5 py-2.5 border-t border-border/40 bg-secondary/15 flex items-center justify-between rounded-b-xl select-none">
                                <div className="flex items-center gap-2 group/btn cursor-pointer">
                                  <span className="text-xs font-bold text-indigo-400 group-hover/btn:text-indigo-300 transition-colors flex items-center gap-1">
                                    Blueprint Workspace
                                    <ArrowRight className="h-3.5 w-3.5 text-indigo-400 group-hover/btn:translate-x-1 transition-transform" strokeWidth={2} />
                                  </span>
                                  {bp.forked_from && (
                                    <Badge variant="outline" className="text-[8px] border-indigo-500/30 text-indigo-400 font-mono py-0">FORKED</Badge>
                                  )}
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[11px] px-3 font-bold bg-secondary/40 hover:bg-secondary/80 text-foreground border-border/60 hover:border-border transition-all hover:-translate-y-0.5 active:translate-y-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/compare?id=${bp.id}`);
                                  }}
                                >
                                  Compare →
                                </Button>
                              </div>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="border border-border bg-card/10 backdrop-blur-md rounded-xl divide-y divide-border/50 overflow-hidden">
                          {unpinnedBlueprints.map(bp => (
                            <div
                              key={bp.id}
                              onClick={() => navigate(`/editor?id=${bp.id}`)}
                              className="group flex flex-col md:flex-row md:items-center justify-between p-4 hover:bg-secondary/20 cursor-pointer transition-all duration-150 gap-4"
                            >
                              <div className="flex items-center gap-3.5 min-w-0">
                                <button
                                  disabled={togglePinMutation.isPending && togglePinMutation.variables === bp.id}
                                  onClick={(e) => handleTogglePin(e, bp.id)}
                                  className="h-7 w-7 rounded-lg flex items-center justify-center border bg-secondary/50 text-muted-foreground border-border hover:text-amber-400 hover:bg-amber-500/10 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Pin Blueprint"
                                >
                                  {togglePinMutation.isPending && togglePinMutation.variables === bp.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
                                  ) : (
                                    <Pin className="h-3.5 w-3.5" strokeWidth={2} />
                                  )}
                                </button>
                                <div className="truncate space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9.5px] font-mono text-muted-foreground/60 tracking-wider font-semibold uppercase">
                                      ID #{bp.id}
                                    </span>
                                    <span className="text-[15px] font-black text-foreground group-hover:text-indigo-400 transition-colors">
                                      {bp.name}
                                    </span>
                                    {bp.forked_from && (
                                      <Badge variant="outline" className="text-[8px] border-indigo-500/30 text-indigo-400 font-mono py-0">FORKED</Badge>
                                    )}
                                  </div>
                                  {bp.description?.trim() && (
                                    <span className="text-[11.5px] text-muted-foreground/70 truncate block max-w-md font-sans">
                                      {bp.description}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-4 shrink-0 select-none text-xs font-sans">
                                <div className="flex items-center gap-3 text-[11px] text-muted-foreground border-r border-border/50 pr-4">
                                  <span title="Versions" className="flex items-center gap-1 font-mono font-semibold">
                                    <Layers className="h-3 w-3 text-purple-400" strokeWidth={2} /> {bp.version_count ?? 0} ver
                                  </span>
                                  <span title="Test Cases" className="flex items-center gap-1 font-mono font-semibold">
                                    <FlaskConical className="h-3 w-3 text-sky-400" strokeWidth={2} /> {bp.test_case_count ?? 0} tests
                                  </span>
                                  <span title="Average AI Score" className="flex items-center gap-1">
                                    {bp.average_ai_score != null ? (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                        🟢 {bp.average_ai_score}/100
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                        🟡 Not Evaluated
                                      </span>
                                    )}
                                  </span>
                                  <span title="Last Updated" className="flex items-center gap-1 text-[10px] text-foreground font-medium">
                                    <Clock className="h-3 w-3 text-indigo-400" strokeWidth={2} /> {formatRelativeOrLocalTimestamp(bp.last_updated)}
                                  </span>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[11px] px-3 font-bold bg-secondary/40 hover:bg-secondary/80 text-foreground border-border/60 hover:border-border transition-all hover:-translate-y-0.5 active:translate-y-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/compare?id=${bp.id}`);
                                  }}
                                >
                                  Compare →
                                </Button>
                                <button
                                  onClick={(e) => handleDeleteBlueprint(e, bp.id, bp.name)}
                                  className="opacity-0 group-hover:opacity-100 h-6 w-6 rounded bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 flex items-center justify-center transition-all cursor-pointer"
                                  title="Delete Blueprint"
                                >
                                  <Trash2 className="h-3 w-3" strokeWidth={2} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    ) : (
                      <div className="p-4 border border-dashed border-border/60 rounded-xl bg-card/10 text-center text-xs text-muted-foreground font-sans">
                        No other blueprints.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Premium Empty State Illustration */
                <div className="text-center py-16 border border-dashed border-border rounded-xl bg-card/5 backdrop-blur-md flex flex-col items-center justify-center select-none">
                  <svg className="w-24 h-24 text-muted-foreground/30 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="9" y1="9" x2="15" y2="9" />
                    <line x1="9" y1="13" x2="15" y2="13" />
                    <line x1="9" y1="17" x2="11" y2="17" />
                  </svg>
                  <h3 className="font-bold text-sm text-foreground">No blueprints found</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
                    Create a new prompt blueprint to start versioning, diffing, and evaluating prompt outputs.
                  </p>
                  <Button onClick={handleOpenCreateModal} className="mt-4 bg-primary hover:bg-primary/95 text-white text-xs h-8 px-3">
                    Create Blueprint
                  </Button>
                </div>
              )}
            </div>

            {/* Right Activity Column */}
            <div className="space-y-4 select-none font-sans">
              <Card className="glass-card min-h-[380px]">
                <CardHeader className="pb-2 border-b border-border/50 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 text-indigo-500" />
                    Recent Platform Activity
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowClearLogsModal(true)}
                    disabled={activities.length === 0}
                    className="h-7 text-[10px] gap-1.5 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-40"
                    title="Clear all activity logs"
                  >
                    <Trash2 className="h-3 w-3" />
                    🗑 Clear Activity Logs
                  </Button>
                </CardHeader>
                <CardContent className="p-0 text-[11px]">
                  <div className="divide-y divide-border/30 max-h-[480px] overflow-y-auto">
                    {activities.length === 0 ? (
                      <div className="p-8 text-center select-none font-sans text-xs flex flex-col items-center justify-center space-y-1.5">
                        <Clock className="h-6 w-6 text-muted-foreground/35 animate-pulse mb-1" />
                        <span className="font-semibold text-foreground/90 text-xs">No recent platform activity.</span>
                        <span className="text-[11px] text-slate-300 dark:text-zinc-400 max-w-[220px] leading-snug">Run your first comparison to see activity here.</span>
                      </div>
                    ) : (
                      activities.map((act) => {
                        const { color, icon: Icon } = getActivityMeta(act.event_type);
                        return (
                          <div key={act.id} className="p-4 hover:bg-secondary/5 transition-colors">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className={`font-semibold ${color} flex items-center gap-1`}>
                                <Icon className="h-3 w-3" />
                                {act.event_type}
                              </span>
                              <span className="text-muted-foreground text-[9px] font-mono">
                                {formatLocalTimestamp(act.created_at)}
                              </span>
                            </div>
                            <p className="text-muted-foreground leading-normal font-sans">
                              {act.description}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* Create Modal Form */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="absolute inset-0" onClick={handleCloseCreateModal} />
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="relative bg-card border border-border rounded-xl w-full max-w-md p-6 shadow-2xl z-55 flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-gradient flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-indigo-500" />
                  Create Blueprint
                </h3>
                <button onClick={handleCloseCreateModal} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateBlueprint} className="space-y-4 mt-4 text-xs">
                <div className="space-y-1.5">
                  <Label htmlFor="bp-name">Blueprint Name</Label>
                  <Input
                    id="bp-name"
                    required
                    placeholder="e.g. Code Review Assistant"
                    value={newBpName}
                    onChange={(e) => {
                      setNewBpName(e.target.value);
                      if (nameError) setNameError(null);
                    }}
                    className={`text-xs ${isDuplicateName || nameError ? "border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/20" : ""}`}
                  />
                  {(isDuplicateName || nameError) && (
                    <p className="text-[11px] text-rose-400 font-medium mt-1 flex items-center gap-1 select-none font-sans">
                      <AlertTriangle className="h-3 w-3 text-rose-500 shrink-0" />
                      This blueprint name already exists.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bp-desc">Description</Label>
                  <Textarea
                    id="bp-desc"
                    placeholder="Describe what tasks this prompt blueprint resolves..."
                    value={newBpDesc}
                    onChange={(e) => setNewBpDesc(e.target.value)}
                    rows={3}
                    className="text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border/50 mt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={handleCloseCreateModal}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    size="sm" 
                    isLoading={createMutation.isPending} 
                    disabled={!newBpName.trim() || isDuplicateName || createMutation.isPending}
                    className="bg-primary hover:bg-primary/95 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Regressions Modal Form */}
      <AnimatePresence>
        {showRegressionsModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="relative bg-card border border-border rounded-xl w-full max-w-4xl p-6 shadow-2xl z-55 flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-gradient flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-rose-500" />
                  Active Regression Warnings Log
                </h3>
                <button onClick={() => setShowRegressionsModal(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 overflow-x-auto max-h-[400px] text-xs font-sans">
                {regressions.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground flex flex-col items-center justify-center space-y-2 select-none">
                    <ShieldCheck className="h-8 w-8 text-emerald-400/35" />
                    <span className="font-semibold text-xs text-foreground">No regressions detected!</span>
                    <p className="text-[10px] text-muted-foreground max-w-sm leading-normal">
                      All compared models and prompt test runs are performing at equal or improved quality ratings.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border/60 text-[10px] uppercase text-muted-foreground tracking-wider font-semibold select-none">
                        <th className="py-2.5 px-3">Blueprint</th>
                        <th className="py-2.5 px-3">Compared Versions</th>
                        <th className="py-2.5 px-3">Test Case</th>
                        <th className="py-2.5 px-3">Regression Reason</th>
                        <th className="py-2.5 px-3 text-right">Date Detected</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {regressions.map((reg) => (
                        <tr key={reg.id} className="hover:bg-secondary/10 transition-colors">
                          <td className="py-3 px-3 font-semibold text-indigo-400 select-all">
                            {reg.blueprint_name}
                          </td>
                          <td className="py-3 px-3 font-mono text-[10px] text-purple-400 select-all">
                            {reg.compared_versions}
                          </td>
                          <td className="py-3 px-3 font-medium select-all">
                            {reg.test_case_name}
                          </td>
                          <td className="py-3 px-3 text-muted-foreground select-all leading-normal max-w-xs break-words">
                            {reg.explanation}
                          </td>
                          <td className="py-3 px-3 text-right text-muted-foreground font-mono text-[10px] whitespace-nowrap">
                            {formatLocalTimestamp(reg.created_at)}
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <button
                              onClick={() => clearRegressionMutation.mutate(reg.id)}
                              disabled={clearRegressionMutation.isPending}
                              className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20 transition-all font-medium cursor-pointer"
                              title="Dismiss warning"
                            >
                              Clear
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border/50 mt-4">
                <div>
                  {regressions.length > 0 && (
                    <Button
                      size="sm"
                      onClick={() => clearAllRegressionsMutation.mutate()}
                      isLoading={clearAllRegressionsMutation.isPending}
                      className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold cursor-pointer"
                    >
                      Clear All Warnings
                    </Button>
                  )}
                </div>
                <Button size="sm" onClick={() => setShowRegressionsModal(false)} className="bg-secondary text-foreground hover:bg-secondary/80">
                  Close Log
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Clear Activity Logs Confirmation Modal */}
      <AnimatePresence>
        {showClearLogsModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="absolute inset-0" onClick={() => !clearLogsMutation.isPending && setShowClearLogsModal(false)} />
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="relative bg-card border border-border rounded-xl w-full max-w-md p-6 shadow-2xl z-55 flex flex-col space-y-4 font-sans select-none"
            >
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                  <Trash2 className="h-4 w-4 text-rose-500" />
                  Clear Activity Logs?
                </h3>
                <button 
                  onClick={() => setShowClearLogsModal(false)} 
                  disabled={clearLogsMutation.isPending}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs text-muted-foreground font-sans leading-relaxed">
                <p className="text-foreground font-medium">
                  Are you sure you want to permanently delete all activity logs?
                </p>
                <p className="text-rose-400/90 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg text-[11px]">
                  This action cannot be undone.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-border/50 select-none">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowClearLogsModal(false)}
                  disabled={clearLogsMutation.isPending}
                  className="h-8 text-xs gap-1.5 font-medium"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => clearLogsMutation.mutate()}
                  isLoading={clearLogsMutation.isPending}
                  disabled={clearLogsMutation.isPending}
                  className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white gap-1.5 font-semibold"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Yes, Clear Logs
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Blueprint Confirmation Modal */}
      <DeleteBlueprintModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget.id);
          }
        }}
        blueprintName={deleteTarget?.name || ""}
        isDeleting={deleteMutation.isPending}
        errorMessage={deleteMutation.isError ? (deleteMutation.error as any)?.response?.data?.detail || "Failed to delete blueprint" : null}
      />

      {/* ── Comparison History Modal ───────────────────────────────── */}
      <AnimatePresence>
        {showCompHistoryModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 select-none"
            onClick={() => setShowCompHistoryModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl p-5 space-y-4 max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-border/40 pb-3 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
                    <ArrowRightLeft className="h-4 w-4" strokeWidth={2} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Comparison History</h3>
                    {compHistory.length > 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        {compHistory.length} successful run{compHistory.length !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setShowCompHistoryModal(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary/50 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* History List / Empty State Body */}
              <div className="flex-1 overflow-y-auto min-h-[200px] max-h-[360px] space-y-2.5 pr-1">
                {isLoadingCompHistory ? (
                  <div className="flex items-center justify-center h-44">
                    <Loader2 className="h-5 w-5 animate-spin text-sky-400" />
                  </div>
                ) : compHistory.length === 0 ? (
                  <div className="py-10 text-center select-none space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mx-auto text-sky-400">
                      <ArrowRightLeft className="h-6 w-6" strokeWidth={1.5} />
                    </div>
                    <h3 className="font-bold text-sm text-foreground">No comparison runs yet.</h3>
                    <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
                      Run a comparison between two prompt versions to see your history here.
                    </p>
                  </div>
                ) : (
                  compHistory.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-secondary/20 border border-border/40 hover:border-sky-500/30 transition-all flex items-center justify-between gap-3 group"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-mono font-black text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                            {item.version_a_label} → {item.version_b_label}
                          </span>
                          {item.comparison_type === "git_diff" && (
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                              <GitCommit className="h-3 w-3" />
                              Git Diff
                            </span>
                          )}
                          <span className="text-xs font-bold text-foreground truncate">
                            {item.blueprint_name}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3 text-indigo-400 shrink-0" />
                          {formatRelativeOrLocalTimestamp(item.created_at)}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[10px] px-2.5 font-bold hover:bg-secondary/60 shrink-0"
                        onClick={() => {
                          setShowCompHistoryModal(false);
                          navigate(`/compare?id=${item.blueprint_id}`);
                        }}
                      >
                        View →
                      </Button>
                    </div>
                  ))
                )}
              </div>

              {/* Modal Footer: Clear Button (Only shown when records exist) */}
              {compHistory.length > 0 && (
                <div className="pt-3 border-t border-border/40 shrink-0 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-bold text-rose-400 hover:text-rose-300 border-rose-500/30 hover:border-rose-500/50 hover:bg-rose-500/10 transition-all cursor-pointer"
                    onClick={() => setShowClearHistoryConfirm(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Clear Comparison History
                  </Button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Clear History Confirmation Dialog ─────────────────────────────── */}
      <AnimatePresence>
        {showClearHistoryConfirm && (
          <div 
            className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 select-none"
            onClick={() => setShowClearHistoryConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-sm bg-card border border-rose-500/30 rounded-xl shadow-2xl p-5 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-rose-500" />
                  Clear comparison history?
                </h3>
                <button
                  onClick={() => setShowClearHistoryConfirm(false)}
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                This will permanently remove your comparison history and reset the Comparison Runs count to 0. Your blueprints and versions will remain intact.
              </p>

              <div className="flex gap-2 justify-end pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-semibold cursor-pointer"
                  onClick={() => setShowClearHistoryConfirm(false)}
                  disabled={clearCompHistoryMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
                  onClick={() => clearCompHistoryMutation.mutate()}
                  isLoading={clearCompHistoryMutation.isPending}
                >
                  Clear History
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
