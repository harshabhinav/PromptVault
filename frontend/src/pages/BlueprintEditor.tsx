import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Editor from "@monaco-editor/react";
import { 
  Save, Play, History, Settings2, Sparkles, Variable, 
  ArrowLeft, GitCommit, Check, Copy, Trash2, Plus, AlertCircle, CopyCheck, Trash, Edit, CheckSquare, X, Layers, ArrowRightLeft, RotateCcw, MessageSquare, MoreVertical, FileText, Loader2
} from "lucide-react";
import { blueprintApi, versionApi, testCaseApi, Blueprint, Version, TestCase } from "../services/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Input, Textarea, Select, Label } from "../components/ui/Input";
import { formatLocalTimestamp, getVersionLabel } from "../utils/date";
import { PromptPlaygroundModal } from "../components/PromptPlaygroundModal";
import { DeleteBlueprintModal } from "../components/DeleteBlueprintModal";
import { useAuth } from "../context/AuthContext";

const EMPTY_TEST_CASES: TestCase[] = [];

export const BlueprintEditor: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const blueprintId = parseInt(searchParams.get("id") || "1");

  const { user, loading: authLoading } = useAuth();
  const isAuthenticated = Boolean(user);

  // Local state for prompt edits
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [activeTab, setActiveTab] = useState<"user" | "system">("user");
  
  // Prompt text buffers
  const [userPrompt, setUserPrompt] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  
  // Model Parameters local states
  const [modelName, setModelName] = useState("claude-3-5-sonnet");
  const [temperature, setTemperature] = useState(0.3);
  const [maxTokens, setMaxTokens] = useState(250);

  // Commit drawer state
  const [commitMsg, setCommitMsg] = useState("");
  const [commitMemo, setCommitMemo] = useState("");  // Optional short commit message
  const [showCommitDrawer, setShowCommitDrawer] = useState(false);
  
  // Test Case list selection and CRUD edit states
  const [selectedTestCaseId, setSelectedTestCaseId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTestCaseId, setEditingTestCaseId] = useState<number | null>(null);
  
  const [tcName, setTcName] = useState("");
  const [tcInput, setTcInput] = useState("");
  const [tcExpected, setTcExpected] = useState("");

  const [copied, setCopied] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showPlayground, setShowPlayground] = useState(false);
  const [useDraftForPlayground, setUseDraftForPlayground] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  // Description editor state
  const [showDescModal, setShowDescModal] = useState(false);
  const [descDraft, setDescDraft] = useState("");

  // Edit blueprint (name + description) modal state
  const [showEditBpModal, setShowEditBpModal] = useState(false);
  const [editBpName, setEditBpName] = useState("");
  const [editBpDesc, setEditBpDesc] = useState("");
  const [showBpMenu, setShowBpMenu] = useState(false);
  const bpMenuRef = React.useRef<HTMLDivElement>(null);

  // Close ⋯ menu on outside click
  React.useEffect(() => {
    if (!showBpMenu) return;
    const handler = (e: MouseEvent) => {
      if (bpMenuRef.current && !bpMenuRef.current.contains(e.target as Node)) {
        setShowBpMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showBpMenu]);

  const handleOpenPlayground = () => {
    if (isUnsaved) {
      setShowUnsavedDialog(true);
    } else {
      setUseDraftForPlayground(false);
      setShowPlayground(true);
    }
  };
  
  // Single test run execution result
  const [singleTestResult, setSingleTestResult] = useState<{ output_text: string; latency: number; token_usage: number; estimated_cost: number; timestamp: string } | null>(null);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };



  // Queries — Strictly gated on authentication state
  const { data: blueprint, isLoading: bpLoading } = useQuery<Blueprint>({
    queryKey: ["blueprint", blueprintId],
    queryFn: () => blueprintApi.get(blueprintId),
    enabled: !!blueprintId && isAuthenticated && !authLoading,
  });

  const { data: versions = [], isLoading: verLoading } = useQuery<Version[]>({
    queryKey: ["versions", blueprintId],
    queryFn: () => versionApi.list(blueprintId),
    enabled: !!blueprintId && isAuthenticated && !authLoading,
  });

  // Fetch test cases for this blueprint
  const { data: testCases = EMPTY_TEST_CASES, refetch: refetchTestCases } = useQuery<TestCase[]>({
    queryKey: ["testCases", blueprintId],
    queryFn: () => testCaseApi.list(blueprintId),
    enabled: !!blueprintId && isAuthenticated && !authLoading,
  });

  // Reset editor state whenever blueprintId changes to ensure a fresh, clean form
  useEffect(() => {
    setSelectedVersion(null);
    setUserPrompt("");
    setSystemPrompt("");
    setModelName("claude-3-5-sonnet");
    setTemperature(0.3);
    setMaxTokens(250);
    setCommitMsg("");
    setCommitMemo("");
    setSelectedTestCaseId(null);
    setEditingTestCaseId(null);
    setShowAddForm(false);
    setTcName("");
    setTcInput("");
    setTcExpected("");
    setSingleTestResult(null);
    setShowPlayground(false);
  }, [blueprintId]);

  // Auto-select latest version if versions exist
  useEffect(() => {
    if (versions.length > 0) {
      // Check if selectedVersion belongs to current versions list
      const isValidVer = versions.some(v => v.id === selectedVersion?.id);
      if (!selectedVersion || !isValidVer) {
        loadVersionDetails(versions[0]);
      }
    } else {
      setSelectedVersion(null);
      setUserPrompt("");
      setSystemPrompt("");
    }
  }, [versions]);

  // Mutations
  const commitVersionMutation = useMutation({
    mutationFn: versionApi.create,
    onSuccess: (newVer) => {
      queryClient.invalidateQueries({ queryKey: ["versions", blueprintId] });
      setSelectedVersion(newVer);
      setShowCommitDrawer(false);
      setCommitMsg("");
      setCommitMemo("");
      triggerToast(`${getVersionLabel(newVer.version_number)} saved successfully!`);
    },
    onError: (err: any) => {
      triggerToast(err?.response?.data?.detail || "Failed to save version");
    }
  });

  const addTestCaseMutation = useMutation({
    mutationFn: (data: { name: string; input_text: string; expected_behavior?: string }) => 
      testCaseApi.create(blueprintId, data),
    onSuccess: () => {
      refetchTestCases();
      setShowAddForm(false);
      setTcName("");
      setTcInput("");
      setTcExpected("");
      triggerToast("Test case added successfully!");
    },
    onError: (err: any) => {
      triggerToast(err?.response?.data?.detail || "Failed to add test case");
    }
  });

  const updateTestCaseMutation = useMutation({
    mutationFn: ({ id, name, input_text, expected_behavior }: { id: number; name: string; input_text: string; expected_behavior?: string }) => 
      testCaseApi.update(id, { name, input_text, expected_behavior }),
    onSuccess: () => {
      refetchTestCases();
      setEditingTestCaseId(null);
      triggerToast("Test case updated successfully.");
    },
    onError: (err: any) => {
      triggerToast(err?.response?.data?.detail || "Failed to update test case");
    }
  });

  const deleteTestCaseMutation = useMutation({
    mutationFn: testCaseApi.delete,
    onSuccess: () => {
      refetchTestCases();
      if (selectedTestCaseId) setSelectedTestCaseId(null);
      triggerToast("Test case removed.");
    },
    onError: (err: any) => {
      triggerToast(err?.response?.data?.detail || "Failed to delete test case");
    }
  });

  const duplicateTestCaseMutation = useMutation({
    mutationFn: testCaseApi.duplicate,
    onSuccess: () => {
      refetchTestCases();
      triggerToast("Test case duplicated.");
    },
    onError: (err: any) => {
      triggerToast(err?.response?.data?.detail || "Failed to duplicate test case");
    }
  });

  const runSingleTestMutation = useMutation({
    mutationFn: testCaseApi.runSingle,
    onSuccess: (data) => {
      setSingleTestResult(data);
      triggerToast("Single test run completed successfully.");
    },
    onError: (err: any) => {
      triggerToast(err?.response?.data?.detail || "Failed to execute single test run.");
    }
  });

  const forkBlueprintMutation = useMutation({
    mutationFn: () => blueprintApi.fork(blueprintId),
    onSuccess: (data) => {
      triggerToast(`Blueprint forked successfully as "${data.name}"`);
      navigate(`/editor?id=${data.id}`);
    },
    onError: (err: any) => {
      triggerToast(err?.response?.data?.detail || "Failed to fork blueprint");
    }
  });

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const deleteBlueprintMutation = useMutation({
    mutationFn: () => blueprintApi.delete(blueprintId),
    onSuccess: () => {
      setShowDeleteModal(false);
      triggerToast("Blueprint deleted successfully.");
      navigate("/");
    },
    onError: (err: any) => {
      triggerToast(err?.response?.data?.detail || "Failed to delete blueprint");
    }
  });

  // Update blueprint metadata (name + description) — never creates a version
  const updateBlueprintMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      blueprintApi.update(blueprintId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blueprint", blueprintId] });
      queryClient.invalidateQueries({ queryKey: ["blueprints"] });
      setShowDescModal(false);
      setShowEditBpModal(false);
      triggerToast("✓ Blueprint updated");
    },
    onError: (err: any) => {
      triggerToast(err?.response?.data?.detail || "Failed to update blueprint");
    }
  });

  const handleSaveDescription = () => {
    if (!blueprint) return;
    updateBlueprintMutation.mutate({ name: blueprint.name, description: descDraft.trim() || undefined });
  };

  const handleSaveEditBp = () => {
    if (!editBpName.trim()) return;
    updateBlueprintMutation.mutate({ name: editBpName.trim(), description: editBpDesc.trim() || undefined });
  };

  const loadVersionDetails = (ver: Version) => {
    setSelectedVersion(ver);
    setUserPrompt(ver.user_prompt || "");
    setSystemPrompt(ver.system_prompt || "");
    
    try {
      const params = JSON.parse(ver.parameters_json || "{}");
      setModelName(params.model || "claude-3-5-sonnet");
      setTemperature(params.temperature !== undefined ? params.temperature : 0.3);
      setMaxTokens(params.max_tokens || 250);
    } catch {
      setModelName("claude-3-5-sonnet");
      setTemperature(0.3);
      setMaxTokens(250);
    }
  };

  const handleEditorChange = (val: string | undefined) => {
    const text = val || "";
    if (activeTab === "user") {
      setUserPrompt(text);
    } else {
      setSystemPrompt(text);
    }
  };

  const handleFork = () => {
    if (confirm("Are you sure you want to fork this prompt blueprint? This clones metadata and versions.")) {
      forkBlueprintMutation.mutate();
    }
  };

  const handleDeleteBlueprint = () => {
    setShowDeleteModal(true);
  };

  const handleCommit = () => {
    const params: Record<string, unknown> = {
      model: modelName,
      temperature: temperature,
      max_tokens: maxTokens,
    };
    if (commitMemo.trim()) {
      params.tag = commitMemo.trim();
    }

    commitVersionMutation.mutate({
      blueprint_id: blueprintId,
      system_prompt: systemPrompt,
      user_prompt: userPrompt,
      parameters_json: JSON.stringify(params)
    });
  };

  // Delete a specific version from the history panel
  const deleteVersionMutation = useMutation({
    mutationFn: (id: number) => versionApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["versions", blueprintId] });
      if (selectedVersion) {
        // If we deleted the selected version, deselect it
        setSelectedVersion(null);
      }
      triggerToast("Version deleted.");
    },
    onError: (err: any) => {
      triggerToast(err?.response?.data?.detail || "Failed to delete version.");
    }
  });

  const handleDeleteVersion = (ver: Version, e: React.MouseEvent) => {
    e.stopPropagation();
    const label = getVersionLabel(ver.version_number);
    if (confirm(`Delete ${label}? This cannot be undone.`)) {
      deleteVersionMutation.mutate(ver.id);
    }
  };

  const handleAddTestCase = () => {
    if (!tcName.trim() || !tcInput.trim()) {
      triggerToast("Name and User Input are required fields.");
      return;
    }
    addTestCaseMutation.mutate({
      name: tcName,
      input_text: tcInput,
      expected_behavior: tcExpected || undefined
    });
  };

  const handleUpdateTestCase = (id: number) => {
    if (!tcName.trim() || !tcInput.trim()) {
      triggerToast("Name and User Input are required fields.");
      return;
    }
    updateTestCaseMutation.mutate({
      id,
      name: tcName,
      input_text: tcInput,
      expected_behavior: tcExpected || undefined
    });
  };

  const handleDeleteTestCase = (id: number) => {
    if (confirm("Remove this test case?")) {
      deleteTestCaseMutation.mutate(id);
    }
  };

  const handleDuplicateTestCase = (id: number) => {
    duplicateTestCaseMutation.mutate(id);
  };

  const handleRunSingleTestCase = () => {
    if (!selectedTestCaseId) {
      triggerToast("Please select a test case from the sidebar first.");
      return;
    }
    const tc = testCases.find(t => t.id === selectedTestCaseId);
    if (!tc) return;

    setSingleTestResult(null); // Clear previous result
    runSingleTestMutation.mutate({
      test_case_id: tc.id,
      system_prompt: systemPrompt,
      user_prompt: userPrompt,
      input_text: tc.input_text,
      expected_behavior: tc.expected_behavior || undefined
    });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(userPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Calc word/char stats
  const characterCount = userPrompt.length;
  const wordCount = userPrompt.trim() === "" ? 0 : userPrompt.trim().split(/\s+/).length;
  
  // Unsaved changes checking
  const isUnsaved = selectedVersion 
    ? (userPrompt !== (selectedVersion.user_prompt || "") || systemPrompt !== (selectedVersion.system_prompt || ""))
    : false;

  // Keyboard Shortcuts: Ctrl+S to save, Ctrl+Enter to run test case
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        setShowCommitDrawer(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleRunSingleTestCase();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTestCaseId, systemPrompt, userPrompt, testCases]);

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
          <video
            src="/pv-logo-loop.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="w-12 h-12 object-contain"
          />
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

  if (bpLoading || verLoading) {
    return (
      <div className="space-y-6 select-none">
        <div className="h-10 bg-secondary/10 rounded-lg animate-pulse border border-border/40" />
        <div className="grid grid-cols-4 gap-6 h-[480px]">
          <div className="col-span-1 bg-secondary/10 rounded-xl border border-border/40 animate-pulse" />
          <div className="col-span-2 bg-secondary/10 rounded-xl border border-border/40 animate-pulse" />
          <div className="col-span-1 bg-secondary/10 rounded-xl border border-border/40 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!blueprint) {
    return (
      <div className="text-center py-20 border border-dashed border-border rounded-xl">
        <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
        <h3 className="font-semibold text-lg text-foreground">Blueprint not found</h3>
        <Button onClick={() => navigate("/")} className="mt-4">Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-12.5rem)] flex flex-col gap-4 relative select-text">
      {/* Toast Alert */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 right-6 z-50 bg-neutral-900 border border-neutral-800 text-white px-4 py-2.5 rounded-lg shadow-xl text-xs flex items-center gap-2"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Head header */}
      <div className="flex items-center justify-between border-b border-border/20 pb-3 shrink-0 select-none">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="outline" size="sm" onClick={() => navigate("/")} className="h-8 w-8 p-0 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-base font-bold flex items-center gap-2 text-foreground">
              {blueprint.name}
              {blueprint.forked_from && (
                <Badge variant="outline" className="text-[8px] border-indigo-500/30 text-indigo-400 font-mono py-0 font-bold">FORK</Badge>
              )}
            </h1>
            {blueprint.description?.trim() ? (
              <p className="text-[10px] text-muted-foreground leading-relaxed max-w-md truncate">
                {blueprint.description}
              </p>
            ) : (
              <button
                onClick={() => { setDescDraft(""); setShowDescModal(true); }}
                className="text-[10px] text-indigo-400/60 hover:text-indigo-400 transition-colors flex items-center gap-1 mt-0.5"
              >
                <FileText className="h-2.5 w-2.5" />
                Add description
              </button>
            )}
          </div>
        </div>

        {/* Right-side: Edit Description + ⋯ menu */}
        <div className="flex items-center gap-2 shrink-0">
          {blueprint.description?.trim() && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px] px-2.5 gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => { setDescDraft(blueprint.description || ""); setShowDescModal(true); }}
            >
              <Edit className="h-3 w-3" />
              Edit Description
            </Button>
          )}

          {/* ⋯ blueprint menu */}
          <div className="relative" ref={bpMenuRef}>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setShowBpMenu(v => !v)}
              title="Blueprint options"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
            <AnimatePresence>
              {showBpMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-9 z-50 min-w-[160px] bg-card border border-border rounded-lg shadow-xl overflow-hidden py-1"
                >
                  <button
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-foreground hover:bg-secondary/50 transition-colors"
                    onClick={() => {
                      setEditBpName(blueprint.name);
                      setEditBpDesc(blueprint.description || "");
                      setShowBpMenu(false);
                      setShowEditBpModal(true);
                    }}
                  >
                    <Edit className="h-3.5 w-3.5 text-indigo-400" />
                    Edit Blueprint
                  </button>
                  <button
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
                    onClick={() => { setShowBpMenu(false); setShowDeleteModal(true); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Blueprint
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Main Three-Column Workspace */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0 overflow-hidden">
        
        {/* Left Column: Version History, Fork, Delete */}
        <div className="col-span-1 flex flex-col gap-4 overflow-y-auto pr-1 select-none">
          <Card className="glass-card shadow-none flex-1 flex flex-col min-h-[300px]">
            <CardHeader className="p-4 border-b border-border/50 shrink-0">
              <CardTitle className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 text-muted-foreground">
                <History className="h-3.5 w-3.5" />
                Version Tree History
              </CardTitle>
            </CardHeader>
            <div className="flex-1 overflow-y-auto p-4 space-y-1 select-none">
              {versions.length === 0 ? (
                <div className="text-center py-8 text-[10px] text-muted-foreground/60">
                  No versions yet. Save your first version to begin.
                </div>
              ) : versions.map((ver, idx) => {
                const isActive = selectedVersion?.id === ver.id;
                const isLatest = idx === 0; // versions are newest-first
                let commitMemoDisplay = "";
                let model = "claude-3-5-sonnet";
                try {
                  const params = JSON.parse(ver.parameters_json || "{}");
                  if (params.tag) commitMemoDisplay = params.tag;
                  if (params.model) model = params.model;
                } catch {}

                const vLabel = getVersionLabel(ver.version_number);
                const displayTs = formatLocalTimestamp(ver.created_at);

                return (
                  <div
                    key={ver.id}
                    onClick={() => loadVersionDetails(ver)}
                    className="relative pl-6 pb-5 cursor-pointer group last:pb-0"
                  >
                    {/* Connecting Vertical Line */}
                    {idx !== versions.length - 1 && (
                      <div className="absolute left-[7px] top-[18px] bottom-0 w-[2px] bg-border/40 group-hover:bg-border/60 transition-colors" />
                    )}

                    {/* Timeline Node Dot */}
                    <div className={`absolute left-0 top-[2px] h-[16px] w-[16px] rounded-full border-2 flex items-center justify-center bg-background transition-all duration-200 ${
                      isActive 
                        ? "border-primary bg-primary/10 shadow-sm shadow-primary/20 scale-110" 
                        : "border-border/60 group-hover:border-border"
                    }`}>
                      <div className={`h-1.5 w-1.5 rounded-full transition-all duration-200 ${
                        isActive ? "bg-primary" : "bg-muted-foreground/30 group-hover:bg-muted-foreground"
                      }`} />
                    </div>

                    {/* Commit Content Card */}
                    <div className={`p-2.5 rounded-xl border transition-all duration-150 ${
                      isActive 
                        ? "bg-secondary border-border/65 shadow-md shadow-black/20" 
                        : "border-transparent hover:bg-secondary/15 hover:border-border/30"
                    }`}>
                      {/* Header row: version label + Latest badge */}
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] font-bold text-foreground tracking-wide">
                            {vLabel}
                          </span>
                          {isLatest && (
                            <span className="px-1.5 py-0.5 text-[7.5px] font-bold font-mono uppercase tracking-wider rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                              Latest
                            </span>
                          )}
                        </div>
                        {/* Per-version quick action buttons */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/compare?id=${blueprintId}`);
                            }}
                            className="h-5 w-5 rounded hover:bg-indigo-500/10 text-indigo-400 flex items-center justify-center"
                            title={`Compare versions`}
                          >
                            <ArrowRightLeft className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteVersion(ver, e)}
                            className="h-5 w-5 rounded hover:bg-rose-500/10 text-rose-500 flex items-center justify-center"
                            title={`Delete ${vLabel}`}
                          >
                            <Trash className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      {/* Timestamp */}
                      <div className="text-[8.5px] text-muted-foreground/70 font-mono mb-1">
                        {displayTs}
                      </div>

                      {/* Commit memo (optional) */}
                      {commitMemoDisplay && (
                        <div className="text-[9px] italic text-muted-foreground/60 truncate mb-1">
                          {commitMemoDisplay}
                        </div>
                      )}

                      {/* Model + Author meta */}
                      <div className="flex items-center justify-between pt-1 text-[8px] text-muted-foreground/45 border-t border-border/10 font-mono">
                        <span>Model: <strong className="text-foreground/60">{model}</strong></span>
                        <span>By: <strong className="text-foreground/60">you</strong></span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Fork / Delete Footer buttons */}
            <div className="p-3 border-t border-border/50 bg-secondary/15 space-y-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleFork}
                isLoading={forkBlueprintMutation.isPending}
                className="w-full h-8 text-[11px] gap-1.5"
              >
                Fork Blueprint
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDeleteBlueprint}
                isLoading={deleteBlueprintMutation.isPending}
                className="w-full h-8 text-[11px] gap-1.5"
              >
                Delete Blueprint
              </Button>
            </div>
          </Card>
        </div>

        {/* Center Column: Large Prompt Editor (Monaco) */}
        <div className="lg:col-span-2 flex flex-col gap-4 min-h-0">
          <Card className="glass-card border border-border flex-1 flex flex-col overflow-hidden relative">
            <div className="flex items-center justify-between border-b border-border/50 bg-secondary/20 px-4 py-2 shrink-0 select-none">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab("user")}
                  className={`px-3 py-1 text-[11px] font-bold rounded-md transition-colors ${
                    activeTab === "user" ? "bg-card text-foreground border border-border/60 shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Prompt Template
                </button>
                <button
                  onClick={() => setActiveTab("system")}
                  className={`px-3 py-1 text-[11px] font-bold rounded-md transition-colors ${
                    activeTab === "system" ? "bg-card text-foreground border border-border/60 shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  System Prompt
                </button>
              </div>
              
              {/* Badges / Indicators */}
              <div className="flex items-center gap-2">
                <AnimatePresence>
                  {isUnsaved && (
                    <motion.span
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] px-2 py-0.5 rounded font-mono font-bold select-none"
                    >
                      UNSAVED CHANGES
                    </motion.span>
                  )}
                </AnimatePresence>
                <span className="text-[10px] text-muted-foreground/60 select-none font-mono">Autosaved</span>
                <Button variant="ghost" size="icon" onClick={copyToClipboard} className="h-7 w-7 text-muted-foreground">
                  {copied ? <Check className="h-3 w-3 text-accent" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>

            {/* Monaco Editor Frame */}
            <div className="flex-1 min-h-0 relative">
              <Editor
                height="100%"
                language="markdown"
                theme="vs-dark"
                value={activeTab === "user" ? userPrompt : systemPrompt}
                onChange={handleEditorChange}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: "on",
                  scrollbar: { vertical: "visible" },
                  wordWrap: "on",
                  padding: { top: 12 }
                }}
              />
            </div>

            {/* Prompt Stats details footer */}
            <div className="flex items-center justify-between px-4 py-1.5 border-t border-border/40 bg-secondary/10 text-[10px] text-muted-foreground/80 font-mono select-none">
              <span>Words: <strong className="text-foreground">{wordCount}</strong></span>
              <span>Characters: <strong className="text-foreground">{characterCount}</strong></span>
            </div>
          </Card>

          {/* RUN SINGLE TEST RESULT CARD */}
          {runSingleTestMutation.isPending && (
            <Card className="glass-card border border-indigo-500/20 bg-indigo-500/5 p-4 shrink-0 flex items-center justify-center space-x-3 select-none">
              <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <span className="text-xs text-muted-foreground animate-pulse">Running live LLM test completion...</span>
            </Card>
          )}

          {singleTestResult && !runSingleTestMutation.isPending && (
            <Card className="glass-card border border-emerald-500/30 bg-emerald-500/5 overflow-hidden shrink-0 flex flex-col max-h-[220px]">
              <CardHeader className="p-3 bg-secondary/20 border-b border-border/50 flex flex-row items-center justify-between select-none shrink-0">
                <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-emerald-500 uppercase tracking-wider">
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Live LLM Completion Result
                </div>
                <div className="flex items-center gap-3 text-[9px] text-muted-foreground font-mono">
                  <span>Latency: <strong className="text-foreground">{singleTestResult.latency.toFixed(2)}s</strong></span>
                  <span>Tokens: <strong className="text-foreground">{singleTestResult.token_usage}</strong></span>
                  <span>Cost: <strong className="text-foreground">${singleTestResult.estimated_cost.toFixed(6)}</strong></span>
                  <span>Time: <strong className="text-foreground">{new Date(singleTestResult.timestamp).toLocaleTimeString()}</strong></span>
                  <button onClick={() => setSingleTestResult(null)} className="text-muted-foreground hover:text-foreground ml-1">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="p-3 overflow-y-auto flex-1 select-text">
                <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed bg-black/40 p-2.5 rounded-lg border border-border/20">
                  {singleTestResult.output_text}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Reusable Test Cases (Add, Edit, Delete, Duplicate) */}
        <div className="col-span-1 flex flex-col gap-4 overflow-y-auto pr-1">
          <Card className="glass-card shadow-none flex-1 flex flex-col min-h-[300px] overflow-hidden">
            <CardHeader className="p-4 border-b border-border/50 flex flex-row items-center justify-between shrink-0 select-none">
              <CardTitle className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 text-muted-foreground">
                <CheckSquare className="h-3.5 w-3.5 text-primary" />
                Test Cases
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[10px] gap-1 px-2 border border-border/50 hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setShowAddForm(!showAddForm);
                  setTcName("");
                  setTcInput("");
                  setTcExpected("");
                }}
              >
                <Plus className="h-3 w-3" />
                Add Case
              </Button>
            </CardHeader>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {/* Add form */}
              {showAddForm && (
                <Card className="p-3 bg-secondary/15 border border-border/50 rounded-lg space-y-3">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">New Test Case</span>
                  <div className="space-y-1.5">
                    <Label htmlFor="add-tc-name" className="text-[10px] text-muted-foreground font-semibold">Test Case Name</Label>
                    <Input 
                      id="add-tc-name" 
                      placeholder="e.g. Refund Request" 
                      value={tcName} 
                      onChange={(e) => setTcName(e.target.value)} 
                      className="h-8 text-xs py-0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="add-tc-input" className="text-[10px] text-muted-foreground font-semibold">User Input (variables JSON or raw text)</Label>
                    <Textarea 
                      id="add-tc-input" 
                      placeholder='e.g. "What is your refund policy?" or {"order_id": "PV-12"}' 
                      value={tcInput} 
                      onChange={(e) => setTcInput(e.target.value)} 
                      rows={3} 
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="add-tc-expected" className="text-[10px] text-muted-foreground font-semibold">Expected Behavior (Optional)</Label>
                    <Textarea 
                      id="add-tc-expected" 
                      placeholder="e.g. Politely explain refund steps" 
                      value={tcExpected} 
                      onChange={(e) => setTcExpected(e.target.value)} 
                      rows={2} 
                      className="text-xs"
                    />
                  </div>
                  <div className="flex justify-end gap-1.5 text-xs">
                    <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => setShowAddForm(false)}>Cancel</Button>
                    <Button size="sm" className="h-7 text-[10px] bg-primary text-white" onClick={handleAddTestCase} isLoading={addTestCaseMutation.isPending}>Save</Button>
                  </div>
                </Card>
              )}

              {/* List of Test Cases */}
              <div className="space-y-3">
                {testCases.length > 0 ? (
                  testCases.map((tc) => {
                    const isSelected = selectedTestCaseId === tc.id;
                    const isEditing = editingTestCaseId === tc.id;

                    if (isEditing) {
                      return (
                        <Card key={tc.id} className="p-3 bg-secondary/15 border border-border/50 rounded-lg space-y-3">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Edit Test Case</span>
                          <div className="space-y-1.5">
                            <Label htmlFor={`edit-tc-name-${tc.id}`} className="text-[10px] text-muted-foreground font-semibold">Test Case Name</Label>
                            <Input 
                              id={`edit-tc-name-${tc.id}`} 
                              value={tcName} 
                              onChange={(e) => setTcName(e.target.value)} 
                              className="h-8 text-xs py-0"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`edit-tc-input-${tc.id}`} className="text-[10px] text-muted-foreground font-semibold">User Input</Label>
                            <Textarea 
                              id={`edit-tc-input-${tc.id}`} 
                              value={tcInput} 
                              onChange={(e) => setTcInput(e.target.value)} 
                              rows={3} 
                              className="text-xs"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`edit-tc-expected-${tc.id}`} className="text-[10px] text-muted-foreground font-semibold">Expected Behavior</Label>
                            <Textarea 
                              id={`edit-tc-expected-${tc.id}`} 
                              value={tcExpected} 
                              onChange={(e) => setTcExpected(e.target.value)} 
                              rows={2} 
                              className="text-xs"
                            />
                          </div>
                          <div className="flex justify-end gap-1.5 text-xs">
                            <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => setEditingTestCaseId(null)}>Cancel</Button>
                            <Button size="sm" className="h-7 text-[10px] bg-primary text-white" onClick={() => handleUpdateTestCase(tc.id)} isLoading={updateTestCaseMutation.isPending}>Save</Button>
                          </div>
                        </Card>
                      );
                    }

                    const statusClass = 
                      tc.last_status === "pass" 
                        ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400" 
                        : tc.last_status === "fail" 
                        ? "border-rose-500/25 bg-rose-500/10 text-rose-400" 
                        : tc.last_status === "changed" 
                        ? "border-amber-500/25 bg-amber-500/10 text-amber-400" 
                        : "border-border/60 bg-secondary/20 text-muted-foreground";

                    return (
                      <motion.div
                        key={tc.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        onClick={() => setSelectedTestCaseId(tc.id)}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all duration-150 relative flex flex-col gap-2.5 ${
                          isSelected
                            ? "bg-indigo-500/5 border-indigo-500 shadow-md shadow-indigo-500/5"
                            : "bg-card/20 border-border/40 hover:border-border/80"
                        }`}
                      >
                        {/* Selector Indicator */}
                        {isSelected && (
                          <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                        )}

                        <div>
                          <div className="flex items-center gap-2 pr-5 mb-1.5">
                            <span className={`text-[8.5px] uppercase font-mono font-extrabold tracking-wider border rounded px-1.5 py-0.5 leading-none shrink-0 ${statusClass}`}>
                              {tc.last_status || "unevaluated"}
                            </span>
                            <strong className="text-xs font-bold text-foreground block truncate">{tc.name}</strong>
                          </div>
                          
                          <div className="text-[10px] text-muted-foreground mt-1 space-y-1 font-sans">
                            <div>
                              <span className="font-semibold text-primary/70">User Input:</span>
                              <p className="mt-0.5 whitespace-pre-wrap bg-black/20 p-1.5 rounded border border-border/20 font-mono text-[9.5px] max-h-[80px] overflow-y-auto">
                                {tc.input_text}
                              </p>
                            </div>
                            {tc.expected_behavior && (
                              <div>
                                <span className="font-semibold text-accent/70">Expected:</span>
                                <p className="mt-0.5 text-foreground/80 bg-black/10 p-1.5 rounded border border-border/10 italic text-[9.5px]">
                                  {tc.expected_behavior}
                                </p>
                              </div>
                            )}
                          </div>
                          
                          {/* Last run execution metrics block */}
                          <div className="flex items-center justify-between text-[9px] text-muted-foreground/60 font-mono pt-1.5 mt-1 border-t border-border/10 select-none">
                            <span>Latency: <strong className="text-foreground/70">{tc.last_latency ? `${tc.last_latency.toFixed(2)}s` : "--"}</strong></span>
                            <span>Run: <strong className="text-foreground/70">{tc.last_run_at ? new Date(tc.last_run_at).toLocaleDateString(undefined, {month: "short", day: "numeric"}) : "Never"}</strong></span>
                          </div>
                        </div>

                        {/* Actions footer */}
                        <div className="flex justify-end gap-2 border-t border-border/20 pt-2 mt-1 select-none">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateTestCase(tc.id);
                            }}
                            className="h-5 w-5 rounded hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
                            title="Duplicate test case"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTestCaseId(tc.id);
                              setTcName(tc.name);
                              setTcInput(tc.input_text);
                              setTcExpected(tc.expected_behavior || "");
                            }}
                            className="h-5 w-5 rounded hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
                            title="Edit test case"
                          >
                            <Edit className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTestCase(tc.id);
                            }}
                            className="h-5 w-5 rounded hover:bg-rose-500/10 text-rose-500 flex items-center justify-center"
                            title="Delete test case"
                          >
                            <Trash className="h-3 w-3" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })
                ) : (
                  <div className="text-center py-10 border border-dashed border-border rounded-xl text-xs text-muted-foreground select-none">
                    No test cases configured. Click "+ Add Case" to save test variables and expected behavior.
                  </div>
                )}
              </div>

            </div>
          </Card>
        </div>
      </div>

      {/* Model Parameter configuration sidebar popover or inline */}
      <Card className="glass-card shadow-none shrink-0 select-none">
        <CardContent className="p-3 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Model Configuration</span>
          </div>
          <div className="grid grid-cols-3 md:col-span-3 gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="model-select" className="text-[11px] shrink-0 font-semibold text-muted-foreground">MODEL</Label>
              <Select id="model-select" value={modelName} onChange={(e) => setModelName(e.target.value)} className="h-8 text-xs py-0">
                <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                <option value="gpt-4o">GPT-4o (OpenAI)</option>
                <option value="gpt-4o-mini">GPT-4o-mini</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <Label htmlFor="temp-slider" className="text-[11px] shrink-0 font-semibold text-muted-foreground">TEMP ({temperature})</Label>
              <input
                id="temp-slider"
                type="range"
                min="0"
                max="1"
                step="0.05"
                className="w-full h-1 bg-secondary rounded-lg appearance-none cursor-pointer accent-indigo-600"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
              />
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor="tokens-input" className="text-[11px] shrink-0 font-semibold text-muted-foreground">TOKENS</Label>
              <Input id="tokens-input" type="number" value={maxTokens} onChange={(e) => setMaxTokens(parseInt(e.target.value) || 100)} className="h-8 text-xs py-0" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* BOTTOM TOOLBAR: Save Version, Compare, Run Tests */}
      <div className="h-14 border border-border/80 bg-card/65 backdrop-blur-md rounded-xl px-4 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${isUnsaved ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
            <span className="font-medium text-[11px]">
              {isUnsaved ? "Draft changes detected. Commit to save history." : "All changes committed to database."}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleOpenPlayground}
            className="h-8 text-xs gap-1.5 border-indigo-500/40 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 font-semibold transition-all"
            title="Open live prompt playground chat for active version"
          >
            <MessageSquare className="h-3.5 w-3.5 text-indigo-400" />
            💬 Prompt Playground
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate(`/compare?id=${blueprintId}`)}
            disabled={versions.length < 2}
            className="h-8 text-xs gap-1.5"
          >
            <History className="h-3.5 w-3.5" />
            Compare Version
          </Button>
          <Button 
            size="sm" 
            onClick={() => setShowCommitDrawer(true)} 
            className="h-8 text-xs gap-1.5 bg-primary hover:bg-primary/95 text-white"
          >
            <GitCommit className="h-3.5 w-3.5" />
            Save Version Node
          </Button>
        </div>
      </div>

      {/* UNSAVED DRAFT CONFIRMATION MODAL */}
      <AnimatePresence>
        {showUnsavedDialog && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 10 }}
              className="bg-card border border-amber-500/40 p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4 font-sans"
            >
              <div className="flex items-center gap-3 text-amber-400">
                <AlertCircle className="h-6 w-6 shrink-0 animate-pulse" />
                <h3 className="text-base font-bold text-foreground">Unsaved Draft Prompt Detected</h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Your editor contains uncommitted draft prompt changes.
                <br /><br />
                Choose how you want to proceed with the Prompt Playground:
              </p>
              <div className="space-y-2 pt-1">
                <Button
                  onClick={() => {
                    setShowUnsavedDialog(false);
                    setUseDraftForPlayground(true);
                    setShowPlayground(true);
                  }}
                  className="w-full h-9 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center justify-center gap-2"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Test Current Draft
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowUnsavedDialog(false);
                    setShowCommitDrawer(true);
                  }}
                  className="w-full h-9 text-xs border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/10 flex items-center justify-center gap-2"
                >
                  <GitCommit className="h-3.5 w-3.5" />
                  Save Version First
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowUnsavedDialog(false)}
                  className="w-full h-8 text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PROMPT PLAYGROUND MODAL */}
      <PromptPlaygroundModal
        isOpen={showPlayground}
        onClose={() => setShowPlayground(false)}
        blueprintName={blueprint.name}
        blueprintId={blueprint.id}
        versions={versions}
        selectedVersion={selectedVersion}
        onSelectVersion={loadVersionDetails}
        isDraft={useDraftForPlayground}
        systemPrompt={systemPrompt}
        userPrompt={userPrompt}
        modelName={modelName}
        temperature={temperature}
        maxTokens={maxTokens}
      />

      {/* COMMIT VERSION DRAWER */}
      <AnimatePresence>
        {showCommitDrawer && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-end z-50">
            <div className="absolute inset-0" onClick={() => setShowCommitDrawer(false)} />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-full max-w-md h-full bg-card border-l border-border p-6 flex flex-col justify-between shadow-2xl z-55"
            >
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-bold flex items-center gap-2 text-gradient">
                    <GitCommit className="h-4.5 w-4.5 text-primary" />
                    Commit Version Node
                  </h2>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Save the prompt system instructions, user variables template, and parameters configurations to version history tree.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Next version number preview */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg">
                    <GitCommit className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="text-[11px] text-foreground/80">
                      This will create{" "}
                      <strong className="text-primary font-mono">
                        {versions.length > 0
                          ? `V${(versions.reduce((max, v) => Math.max(max, v.version_number ?? 0), 0)) + 1}`
                          : "V1"}
                      </strong>
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="commit-memo" className="text-xs">Commit Message <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Input
                      id="commit-memo"
                      placeholder="e.g. More empathetic tone, shorter responses"
                      value={commitMemo}
                      onChange={(e) => setCommitMemo(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <div className="p-3 bg-secondary/20 border border-border/50 rounded-lg text-[10.5px] space-y-1">
                    <span className="font-semibold block text-[11px]">Draft Metadata summary</span>
                    <span className="text-muted-foreground block truncate">System: {systemPrompt || "<empty>"}</span>
                    <span className="text-muted-foreground block truncate">Template length: {userPrompt.length} chars</span>
                    <span className="text-muted-foreground block">Model: {modelName} • Temp: {temperature}</span>
                  </div>
                  {commitVersionMutation.isError && (
                    <div className="p-2.5 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive flex items-center gap-2">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>{(commitVersionMutation.error as any)?.response?.data?.detail || "Unable to save version. Please try again."}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 border-t border-border/50 pt-4 select-none">
                <Button variant="outline" className="flex-1 h-9 text-xs" onClick={() => setShowCommitDrawer(false)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 h-9 text-xs bg-primary hover:bg-primary/95 text-white"
                  onClick={handleCommit}
                  isLoading={commitVersionMutation.isPending}
                >
                  Confirm Save
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Blueprint Confirmation Modal */}
      <DeleteBlueprintModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={() => deleteBlueprintMutation.mutate()}
        blueprintName={blueprint?.name || "this blueprint"}
        isDeleting={deleteBlueprintMutation.isPending}
        errorMessage={deleteBlueprintMutation.isError ? (deleteBlueprintMutation.error as any)?.response?.data?.detail || "Failed to delete blueprint" : null}
      />

      {/* ── Edit Description Modal ─────────────────────────────────── */}
      <AnimatePresence>
        {showDescModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={() => setShowDescModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl p-5 space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4 text-indigo-400" />
                  {blueprint?.description?.trim() ? "Edit Description" : "Add Description"}
                </h3>
                <button onClick={() => setShowDescModal(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Description</Label>
                <Textarea
                  rows={4}
                  value={descDraft}
                  onChange={e => setDescDraft(e.target.value)}
                  placeholder="Write a short description for this blueprint..."
                  className="resize-none text-xs"
                  autoFocus
                />
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowDescModal(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs bg-primary hover:bg-primary/90 text-white"
                  onClick={handleSaveDescription}
                  isLoading={updateBlueprintMutation.isPending}
                >
                  Save
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Edit Blueprint Modal (Name + Description) ─────────────── */}
      <AnimatePresence>
        {showEditBpModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={() => setShowEditBpModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl p-5 space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Edit className="h-4 w-4 text-indigo-400" />
                  Edit Blueprint
                </h3>
                <button onClick={() => setShowEditBpModal(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Blueprint Name</Label>
                  <Input
                    value={editBpName}
                    onChange={e => setEditBpName(e.target.value)}
                    placeholder="e.g. Code Review Assistant"
                    className="text-xs"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Description <span className="text-muted-foreground/50 font-normal normal-case">(optional)</span>
                  </Label>
                  <Textarea
                    rows={3}
                    value={editBpDesc}
                    onChange={e => setEditBpDesc(e.target.value)}
                    placeholder="Write a short description for this blueprint..."
                    className="resize-none text-xs"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowEditBpModal(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs bg-primary hover:bg-primary/90 text-white"
                  onClick={handleSaveEditBp}
                  disabled={!editBpName.trim()}
                  isLoading={updateBlueprintMutation.isPending}
                >
                  Save Changes
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
