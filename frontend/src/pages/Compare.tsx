import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  ArrowRightLeft, Play, Sparkles, AlertCircle, Clock, Zap, Columns, Layers, ThumbsUp, ThumbsDown, Eye, CheckSquare, Download, Printer, GitCommit, FileText, Check
} from "lucide-react";
import { blueprintApi, versionApi, compareApi, Blueprint, Version, CompareResponse, VersionScores } from "../services/api";
import { PromptDiff } from "../components/PromptDiff";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Select, Label } from "../components/ui/Input";
import { getVersionLabel } from "../utils/date";

const EMPTY_BLUEPRINTS: Blueprint[] = [];
const EMPTY_VERSIONS: Version[] = [];

export const Compare: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialBpId = parseInt(searchParams.get("id") || "1");

  const [selectedBpId, setSelectedBpId] = useState<number>(initialBpId);
  const [versionA, setVersionA] = useState<Version | null>(null);
  const [versionB, setVersionB] = useState<Version | null>(null);
  
  const [isDiffGenerated, setIsDiffGenerated] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    setIsDiffGenerated(false);
    compareMutation.reset();
    setRunWinners({});
    setDiffOutputIndices({});
  }, [selectedBpId, versionA?.id, versionB?.id]);

  const [diffOutputIndices, setDiffOutputIndices] = useState<Record<number, boolean>>({});
  const [runWinners, setRunWinners] = useState<Record<number, "A" | "B" | null>>({});

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const { data: blueprints = EMPTY_BLUEPRINTS, isLoading: bpLoading } = useQuery<Blueprint[]>({
    queryKey: ["blueprints"],
    queryFn: blueprintApi.list,
  });

  const { data: versions = EMPTY_VERSIONS, isLoading: verLoading, refetch: refetchVersions } = useQuery<Version[]>({
    queryKey: ["compare-versions", selectedBpId],
    queryFn: () => versionApi.list(selectedBpId),
    enabled: !!selectedBpId,
  });

  useEffect(() => {
    if (blueprints && blueprints.length > 0 && !searchParams.get("id")) {
      const exists = blueprints.some(bp => bp.id === selectedBpId);
      if (!exists) {
        setSelectedBpId(blueprints[0].id);
      }
    }
  }, [blueprints, searchParams]);

  useEffect(() => {
    const urlId = searchParams.get("id");
    if (urlId) {
      const parsed = parseInt(urlId);
      if (!isNaN(parsed) && parsed !== selectedBpId) {
        setSelectedBpId(parsed);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (selectedBpId) {
      refetchVersions();
    }
  }, [selectedBpId]);

  // Sync versions list to selection inputs: Version A = Earliest (V1), Version B = Latest (e.g. V5)
  useEffect(() => {
    if (!versions || versions.length === 0) {
      if (versionA !== null || versionB !== null) {
        setVersionA(null);
        setVersionB(null);
      }
      return;
    }

    if (versions.length >= 2) {
      const earliest = versions[versions.length - 1]; // Earliest version (normally V1)
      const latest = versions[0]; // Latest version (e.g. V5)

      setVersionA(earliest);
      setVersionB(latest);
      setIsDiffGenerated(false);
      compareMutation.reset();
      setRunWinners({});
      setDiffOutputIndices({});
    } else if (versions.length === 1) {
      const single = versions[0];
      setVersionA(single);
      setVersionB(single);
      setIsDiffGenerated(false);
      compareMutation.reset();
      setRunWinners({});
      setDiffOutputIndices({});
    }
  }, [versions]);

  // Derived disabled states
  const hasMultipleVersions = (versions || []).length >= 2;
  const isSameVersion = !!(versionA && versionB && versionA.id === versionB.id);
  const resultsRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Comparison Mutation (for Concurrent Evaluator ONLY)
  const compareMutation = useMutation({
    mutationFn: compareApi.run,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-activities"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-regressions"] });
      queryClient.invalidateQueries({ queryKey: ["blueprints"] });
      triggerToast("Concurrent behavioral evaluation completed successfully.");
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail;
      let errMsg = "Concurrent evaluation execution failed.";
      if (typeof detail === "object" && detail?.message) {
        errMsg = detail.message;
      } else if (typeof detail === "string") {
        errMsg = detail;
      } else if (err?.message) {
        errMsg = err.message;
      }

      // We only want to override the message if it's explicitly a missing key error.
      // Other Gemini errors (like rate limits) should be displayed directly.
      if (err?.response?.data?.detail?.error === "gemini_api_key_missing") {
        triggerToast("⚠ Google Gemini API key not configured. Please add it in Settings.");
      } else {
        triggerToast(errMsg);
      }
    }
  });
  // Git Diff Mutation to track history
  const gitDiffMutation = useMutation({
    mutationFn: compareApi.logGitDiff,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-activities"] });
      setIsDiffGenerated(true);
      triggerToast("Visual Git Diff generated and logged.");
    },
    onError: () => {
      // Even if logging fails, show diff
      setIsDiffGenerated(true);
      triggerToast("Visual Git Diff generated (logging failed).");
    }
  });

  // Action 1: Evaluate Git Diff ONLY (Client-side visual comparison + log to history)
  const handleEvaluateGitDiff = () => {
    if (!versionA || !versionB) {
      triggerToast("Please select two versions to compare.");
      return;
    }
    if (isSameVersion) {
      triggerToast("Please select two different versions to compare.");
      return;
    }
    
    gitDiffMutation.mutate({
      versionA: versionA.id,
      versionB: versionB.id,
      blueprintId: selectedBpId
    });
  };

  // Action 2: Concurrent Behavioral Evaluation ONLY (Backend API call)
  const handleRunConcurrentEvaluation = () => {
    if (!isDiffGenerated) {
      triggerToast("Please generate the Visual Git Diff first.");
      return;
    }
    if (!versionA || !versionB || isSameVersion) {
      triggerToast("Please select two different versions to evaluate.");
      return;
    }
    compareMutation.mutate({
      versionA: versionA.id,
      versionB: versionB.id
    });
  };

  const handleBpChange = (val: string) => {
    const id = parseInt(val);
    setSelectedBpId(id);
    navigate(`/compare?id=${id}`);
    setIsDiffGenerated(false);
    compareMutation.reset();
  };

  const toggleOutputDiff = (index: number) => {
    setDiffOutputIndices(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const handleExport = (format: "json" | "markdown" | "pdf") => {
    if (!compareMutation.data) return;
    const data = compareMutation.data;
    
    if (format === "json") {
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`;
      const link = document.createElement("a");
      link.setAttribute("href", jsonString);
      link.setAttribute("download", `promptvault-compare-${selectedBpId}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      triggerToast("Comparison exported as JSON!");
    } else if (format === "markdown") {
      let md = `# PromptVault Comparison Report\n\n`;
      md += `## AI Summary\n`;
      md += `**Behavior Changes**: ${data.summary.behavior_changes}\n`;
      md += `**Recommendation**: ${data.summary.recommendation}\n\n`;
      
      md += `### Strengths\n`;
      data.summary.strengths.forEach((s: string) => { md += `- ${s}\n`; });
      md += `\n### Weaknesses\n`;
      data.summary.weaknesses.forEach((w: string) => { md += `- ${w}\n`; });
      
      md += `\n## Regression Tests\n`;
      data.regression_report.forEach((item: any) => {
        md += `- **${item.test_case_name}** [${item.status.toUpperCase()}]: ${item.explanation}\n`;
      });
      
      md += `\n## Results Details\n`;
      data.resultsA.forEach((rA: any, idx: number) => {
        const rB = data.resultsB[idx];
        md += `### Test Case: ${rA.test_case_name}\n`;
        md += `**Input**: \`${rA.input_text}\`\n\n`;
        md += `#### Output A\n${rA.output_text}\n\n`;
        md += `#### Output B\n${rB.output_text}\n\n`;
        md += `**Winner**: Version ${runWinners[idx] || "Unevaluated"}\n`;
        md += `**Latency**: A: ${rA.latency.toFixed(2)}s vs B: ${rB.latency.toFixed(2)}s\n`;
        md += `**Tokens**: A: ${rA.token_usage} vs B: ${rB.token_usage}\n`;
        md += `**Cost**: A: $${rA.estimated_cost.toFixed(6)} vs B: $${rB.estimated_cost.toFixed(6)}\n`;
        if (data.test_case_comments[rA.test_case_id]) {
          md += `**AI Comment**: ${data.test_case_comments[rA.test_case_id]}\n`;
        }
        md += `\n---\n\n`;
      });
      
      const mdString = `data:text/markdown;charset=utf-8,${encodeURIComponent(md)}`;
      const link = document.createElement("a");
      link.setAttribute("href", mdString);
      link.setAttribute("download", `promptvault-compare-${selectedBpId}.md`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      triggerToast("Comparison exported as Markdown!");
    } else {
      window.print();
    }
  };

  const selectRunWinner = (index: number, winner: "A" | "B") => {
    setRunWinners(prev => ({
      ...prev,
      [index]: winner
    }));
    triggerToast(`Marked Version ${winner} as winner for test run #${index + 1}!`);
  };

  const hasRuns = compareMutation.data;
  const metrics = compareMutation.data?.metrics;

  try {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6 pb-10 min-h-0 relative select-text"
      >
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

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-border/20 pb-4 shrink-0 select-none">
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-indigo-500" />
              Compare Prompt Versions
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Perform visual Git diffs and evaluate model completions concurrently.</p>
          </div>
        </div>

        <Card className="glass-card shadow-none shrink-0 select-none">
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-end text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="bp-select">Prompt Blueprint</Label>
              <Select id="bp-select" value={selectedBpId} onChange={(e) => handleBpChange(e.target.value)} className="h-8 text-xs py-0">
                {bpLoading ? (
                  <option>Loading blueprints...</option>
                ) : (
                  (blueprints || []).map(bp => (
                    <option key={bp.id} value={bp.id}>{bp.name}</option>
                  ))
                )}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ver-a" className="flex items-center gap-1.5">
                Version A
                {versionA && <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 inline-block" />}
              </Label>
              <Select
                id="ver-a"
                value={versionA?.id || ""}
                onChange={(e) => {
                  setVersionA((versions || []).find(v => v.id === parseInt(e.target.value)) || null);
                  setIsDiffGenerated(false);
                  compareMutation.reset();
                }}
                className={`h-8 text-xs py-0 font-semibold transition-all ${
                  versionA ? "border-indigo-500/60 bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-500/30" : ""
                }`}
              >
                {verLoading ? (
                  <option>Loading versions...</option>
                ) : (
                  (versions || []).map((v) => {
                    const vLabel = getVersionLabel(v.version_number);
                    let memo = "";
                    try {
                      const params = JSON.parse(v.parameters_json || "{}");
                      if (params.tag) memo = params.tag;
                    } catch {}
                    return (
                      <option key={v.id} value={v.id}>{vLabel}{memo ? ` — ${memo}` : ""}</option>
                    );
                  })
                )}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ver-b" className="flex items-center gap-1.5">
                Version B
                {versionB && <span className="h-1.5 w-1.5 rounded-full bg-purple-500 inline-block" />}
              </Label>
              <Select
                id="ver-b"
                value={versionB?.id || ""}
                onChange={(e) => {
                  setVersionB((versions || []).find(v => v.id === parseInt(e.target.value)) || null);
                  setIsDiffGenerated(false);
                  compareMutation.reset();
                }}
                className={`h-8 text-xs py-0 font-semibold transition-all ${
                  versionB ? "border-purple-500/60 bg-purple-500/10 text-purple-300 ring-1 ring-purple-500/30" : ""
                }`}
              >
                {verLoading ? (
                  <option>Loading versions...</option>
                ) : (
                  (versions || []).map((v) => {
                    const vLabel = getVersionLabel(v.version_number);
                    let memo = "";
                    try {
                      const params = JSON.parse(v.parameters_json || "{}");
                      if (params.tag) memo = params.tag;
                    } catch {}
                    return (
                      <option key={v.id} value={v.id}>{vLabel}{memo ? ` — ${memo}` : ""}</option>
                    );
                  })
                )}
              </Select>
            </div>
            
            <Button 
              onClick={handleEvaluateGitDiff} 
              disabled={!hasMultipleVersions || isSameVersion || !versionA || !versionB}
              className="w-full gap-2 bg-primary hover:bg-primary/95 text-white h-8 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowRightLeft className="h-3.5 w-3.5 shrink-0" />
              Evaluate Git Diff
            </Button>

            {isSameVersion && hasMultipleVersions && (
              <div className="col-span-full mt-1 p-2.5 bg-amber-500/10 border border-amber-500/25 rounded-lg text-amber-400 text-xs font-sans flex items-center gap-2 select-none">
                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                <span className="font-semibold">Please select two different versions.</span>
              </div>
            )}

            {!hasMultipleVersions && (versions || []).length === 1 && (
              <div className="col-span-full mt-1 p-2.5 bg-amber-500/10 border border-amber-500/25 rounded-lg text-amber-400 text-xs font-sans flex items-center gap-2 select-none">
                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                <span>Create another version to enable comparison.</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card shadow-none">
          <CardHeader className="p-4 border-b border-border/50 select-none">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Visual Prompt Comparison (Git Diff)
            </CardTitle>
            <CardDescription className="text-[11px] text-muted-foreground">
              Compare system prompt and user template instructions line-by-line.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {isDiffGenerated && versionA && versionB ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground select-none px-2 py-1 bg-secondary/15 rounded-lg border border-border/30 font-mono">
                  <span>Version A — {getVersionLabel(versionA.version_number)}</span>
                  <span>Version B — {getVersionLabel(versionB.version_number)}</span>
                </div>
                
                {versionA.system_prompt !== versionB.system_prompt && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">System Prompt Differences</span>
                    <PromptDiff original={versionA.system_prompt || ""} modified={versionB.system_prompt || ""} />
                  </div>
                )}

                <div className="space-y-1.5">
                  {versionA.system_prompt !== versionB.system_prompt && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">User Prompt Template Differences</span>
                  )}
                  <PromptDiff original={versionA.user_prompt || ""} modified={versionB.user_prompt || ""} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center border border-dashed border-border rounded-xl select-none py-10 space-y-2 text-center bg-card/5">
                <ArrowRightLeft className="h-8 w-8 text-muted-foreground/35" />
                <span className="text-muted-foreground text-xs font-sans max-w-sm">
                  Select Version A and Version B above, then click <strong>"Evaluate Git Diff"</strong> to view visual prompt differences.
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card shadow-none">
          <CardHeader className="p-4 border-b border-border/50 flex flex-row items-center justify-between select-none">
            <div>
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-400" />
                Concurrent Evaluator
              </CardTitle>
              <CardDescription className="text-[11px] text-muted-foreground mt-0.5">
                Execute saved test cases concurrently, analyze model completions, and generate AI scorecards.
              </CardDescription>
            </div>

            <Button
              onClick={handleRunConcurrentEvaluation}
              disabled={!hasMultipleVersions || isSameVersion || !isDiffGenerated || !versionA || !versionB || compareMutation.isPending}
              isLoading={compareMutation.isPending}
              className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white h-8 text-xs font-semibold px-4 disabled:opacity-50 disabled:cursor-not-allowed"
              title={!isDiffGenerated ? "Generate Visual Git Diff first before running evaluation" : "Run test cases and generate evaluation"}
            >
              {compareMutation.isPending ? (
                <div className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin shrink-0" />
              ) : (
                <Play className="h-3.5 w-3.5 fill-current shrink-0" />
              )}
              Evaluate
            </Button>
          </CardHeader>

          <CardContent className="p-4">
            {compareMutation.isPending ? (
              <div className="py-14 flex flex-col items-center justify-center space-y-4 select-none">
                <div className="h-9 w-9 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
                <span className="text-xs text-muted-foreground animate-pulse font-sans">
                  Executing test inputs concurrently via asyncio.gather() and generating AI scorecards...
                </span>
              </div>
            ) : !isDiffGenerated ? (
              <div className="py-10 flex flex-col items-center justify-center border border-dashed border-border rounded-xl select-none space-y-3 text-center bg-card/5">
                <Sparkles className="h-8 w-8 text-muted-foreground/30" />
                <div className="space-y-1">
                  <span className="text-xs font-bold text-muted-foreground block font-sans">No evaluation has been performed.</span>
                  <p className="text-[11px] text-muted-foreground/70 max-w-sm font-sans">
                    Generate the Visual Git Diff above to enable behavioural evaluation.
                  </p>
                </div>
              </div>
            ) : !hasRuns ? (
              <div className="py-10 flex flex-col items-center justify-center border border-dashed border-border rounded-xl select-none space-y-3 text-center bg-card/5">
                <Sparkles className="h-8 w-8 text-indigo-400/60 animate-pulse" />
                <div className="space-y-1">
                  <span className="text-xs font-bold text-foreground block font-sans">No evaluation has been performed.</span>
                  <p className="text-[11px] text-muted-foreground/80 max-w-md font-sans">
                    Click the <strong>"Evaluate"</strong> button above to run all saved test cases, generate side-by-side outputs, AI scorecard, and regression report.
                  </p>
                </div>
              </div>
            ) : (
              <div ref={resultsRef} className="space-y-5 print-content">
                <div className="flex items-center justify-between bg-secondary/10 border border-border/40 p-3 rounded-xl select-none no-print">
                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-indigo-400" />
                    Behavioral evaluation complete. Export report:
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleExport("json")} className="h-7 text-[10px] gap-1 px-2.5 font-bold">
                      <Download className="h-3 w-3" />
                      JSON
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleExport("markdown")} className="h-7 text-[10px] gap-1 px-2.5 font-bold">
                      <Download className="h-3 w-3" />
                      Markdown
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} className="h-7 text-[10px] gap-1 px-2.5 font-bold bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/25">
                      <Printer className="h-3 w-3" />
                      Print PDF
                    </Button>
                  </div>
                </div>

                <style>{`
                  @media print {
                    nav, aside, header, .no-print, button, .shrink-0, select, label {
                      display: none !important;
                    }
                    .print-content {
                      width: 100% !important;
                      max-width: 100% !important;
                      padding: 0 !important;
                      margin: 0 !important;
                      background: white !important;
                      color: black !important;
                    }
                    .glass-card {
                      background: white !important;
                      color: black !important;
                      border: 1px solid #ddd !important;
                      box-shadow: none !important;
                    }
                    pre, code {
                      background: #f5f5f5 !important;
                      color: #111 !important;
                      border: 1px solid #ccc !important;
                    }
                  }
                `}</style>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {hasRuns.scorecard && (
                    <Card className="glass-card p-5 border border-indigo-500/20 bg-indigo-950/5">
                      <CardHeader className="p-0 pb-3 border-b border-border/45 select-none">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                          <Layers className="h-4 w-4" />
                          AI Prompt Quality Scorecard (A vs B)
                        </CardTitle>
                      </CardHeader>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3.5 pt-4 text-[10.5px] font-sans">
                        {(Object.keys(hasRuns.scorecard.version_a) as (keyof VersionScores)[]).map((metricKey) => {
                          const valA = hasRuns.scorecard.version_a[metricKey] || 0;
                          const valB = hasRuns.scorecard.version_b[metricKey] || 0;
                          const label = metricKey.toUpperCase().replace("_", " ");
                          
                          return (
                            <div key={metricKey} className="space-y-1.5">
                              <div className="flex items-center justify-between font-semibold">
                                <span className="text-muted-foreground">{label}</span>
                                <span className="font-mono text-[10px]">
                                  A: <span className="text-indigo-400">{valA}%</span> | B: <span className="text-purple-400">{valB}%</span>
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 h-1.5 select-none">
                                <div className="w-full bg-secondary/35 rounded-full h-full overflow-hidden">
                                  <div className="bg-indigo-500 h-full rounded-full transition-all duration-300" style={{ width: `${valA}%` }} />
                                </div>
                                <div className="w-full bg-secondary/35 rounded-full h-full overflow-hidden">
                                  <div className="bg-purple-500 h-full rounded-full transition-all duration-300" style={{ width: `${valB}%` }} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  )}

                  {hasRuns.regression_report && hasRuns.regression_report.length > 0 && (
                    <Card className="glass-card p-5 border border-rose-500/20 bg-rose-950/5">
                      <CardHeader className="p-0 pb-3 border-b border-border/45 select-none">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                          <AlertCircle className="h-4 w-4" />
                          Regression Test Summary
                        </CardTitle>
                      </CardHeader>
                      <div className="divide-y divide-border/20 pt-2 text-xs font-sans max-h-[190px] overflow-y-auto">
                        {hasRuns.regression_report.map((item) => {
                          let badgeColor = "border-border text-muted-foreground bg-secondary/20";
                          let badgeIcon = "⚠";
                          if (item.status === "improved") {
                            badgeColor = "border-emerald-500/30 text-emerald-400 bg-emerald-500/5";
                            badgeIcon = "✅";
                          } else if (item.status === "worse") {
                            badgeColor = "border-rose-500/30 text-rose-400 bg-rose-500/5";
                            badgeIcon = "❌";
                          }
                          
                          return (
                            <div key={item.test_case_id} className="py-2.5 flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <span className="font-bold text-foreground block truncate">{item.test_case_name}</span>
                                <p className="text-[10px] text-muted-foreground/80 leading-relaxed mt-0.5">{item.explanation}</p>
                              </div>
                              <span className={`text-[8.5px] uppercase font-mono font-bold border rounded px-1.5 py-0.5 flex items-center gap-1 shrink-0 select-none ${badgeColor}`}>
                                <span>{badgeIcon}</span>
                                {item.status.replace("_", " ")}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  )}
                </div>

                {hasRuns.summary && (
                  <Card className="glass-card border border-primary/30 bg-primary/5 p-5 space-y-4 font-sans">
                    <div className="border-b border-primary/20 pb-3 flex items-center justify-between select-none font-sans">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                        AI Comparative Analysis Summary
                      </h3>
                      <Badge className="bg-primary/20 border border-primary/30 text-primary text-[8.5px] font-mono font-bold tracking-wider py-0.5">
                        EVALUATION READY
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl border border-sky-500/20 bg-sky-500/5 text-sky-100/90 flex flex-col gap-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-sky-400">BEHAVIOR CHANGES</span>
                        <p className="text-xs leading-relaxed">{hasRuns.summary.behavior_changes}</p>
                      </div>
                      <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10 shadow-md shadow-indigo-500/5 text-indigo-100 flex flex-col gap-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">RECOMMENDATION</span>
                        <p className="text-xs leading-relaxed font-semibold">{hasRuns.summary.recommendation}</p>
                      </div>
                      <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-100/90 flex flex-col gap-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">STRENGTHS</span>
                        <ul className="list-disc list-inside text-xs space-y-1">
                          {hasRuns.summary.strengths.map((str, sIdx) => <li key={sIdx}>{str}</li>)}
                        </ul>
                      </div>
                      <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-100/90 flex flex-col gap-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-amber-400">WEAKNESSES</span>
                        <ul className="list-disc list-inside text-xs space-y-1">
                          {hasRuns.summary.weaknesses.map((wk, wIdx) => <li key={wIdx}>{wk}</li>)}
                        </ul>
                      </div>
                    </div>
                  </Card>
                )}

                {metrics && (
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4 select-none">
                    <Card className="glass-card">
                      <CardContent className="p-3 text-center">
                        <span className="text-[8.5px] text-muted-foreground uppercase block font-bold tracking-wider">Avg Latency A</span>
                        <strong className="text-sm font-black flex justify-center items-center gap-1 mt-1">
                          <Clock className="h-3.5 w-3.5 text-amber-500" />
                          {metrics.averageLatencyA}s
                        </strong>
                      </CardContent>
                    </Card>
                    <Card className="glass-card">
                      <CardContent className="p-3 text-center">
                        <span className="text-[8.5px] text-muted-foreground uppercase block font-bold tracking-wider">Avg Latency B</span>
                        <strong className="text-sm font-black flex justify-center items-center gap-1 mt-1">
                          <Clock className="h-3.5 w-3.5 text-amber-500" />
                          {metrics.averageLatencyB}s
                        </strong>
                      </CardContent>
                    </Card>
                    <Card className="glass-card">
                      <CardContent className="p-3 text-center">
                        <span className="text-[8.5px] text-muted-foreground uppercase block font-bold tracking-wider">Total Tokens A</span>
                        <strong className="text-sm font-black flex justify-center items-center gap-1 mt-1">
                          <Zap className="h-3.5 w-3.5 text-indigo-400" />
                          {metrics.totalTokensA}
                        </strong>
                      </CardContent>
                    </Card>
                    <Card className="glass-card">
                      <CardContent className="p-3 text-center">
                        <span className="text-[8.5px] text-muted-foreground uppercase block font-bold tracking-wider">Total Tokens B</span>
                        <strong className="text-sm font-black flex justify-center items-center gap-1 mt-1">
                          <Zap className="h-3.5 w-3.5 text-purple-400" />
                          {metrics.totalTokensB}
                        </strong>
                      </CardContent>
                    </Card>
                    <Card className="glass-card">
                      <CardContent className="p-3 text-center">
                        <span className="text-[8.5px] text-muted-foreground uppercase block font-bold tracking-wider">Cost A</span>
                        <strong className="text-sm font-black flex justify-center items-center gap-1 mt-1 text-indigo-400">
                          ${metrics.estimatedCostA.toFixed(5)}
                        </strong>
                      </CardContent>
                    </Card>
                    <Card className="glass-card">
                      <CardContent className="p-3 text-center">
                        <span className="text-[8.5px] text-muted-foreground uppercase block font-bold tracking-wider">Cost B</span>
                        <strong className="text-sm font-black flex justify-center items-center gap-1 mt-1 text-purple-400">
                          ${metrics.estimatedCostB.toFixed(5)}
                        </strong>
                      </CardContent>
                    </Card>
                  </div>
                )}

                <div className="space-y-4">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block select-none">Test Cases Comparison Log</span>
                  {hasRuns.resultsA.length === 0 ? (
                    <div className="flex flex-col items-center justify-center border border-dashed border-border rounded-xl select-none py-14 text-center space-y-2 bg-card/10">
                      <CheckSquare className="h-8 w-8 text-muted-foreground/35 animate-pulse" />
                      <span className="text-muted-foreground text-xs font-semibold font-sans">No test cases configured for this blueprint.</span>
                      <p className="text-[10px] text-muted-foreground max-w-sm px-4 leading-normal font-sans">
                        Go to the <strong>Prompt Editor</strong> tab to add test cases.
                      </p>
                    </div>
                  ) : (
                    hasRuns.resultsA.map((runA, index) => {
                      const runB = hasRuns.resultsB[index];
                      const winner = runWinners[index];
                      const showDiff = !!diffOutputIndices[index];
                      const aiComment = hasRuns.test_case_comments[runA.test_case_id.toString()];

                      return (
                        <div key={index} className="space-y-3.5 p-4 rounded-xl border border-border bg-card/25 backdrop-blur-md">
                          <div className="flex flex-col gap-1.5 border-b border-border/40 pb-3 mb-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-foreground font-sans">
                                Test Case #{index + 1}: <strong className="text-indigo-400 font-extrabold">{runA.test_case_name}</strong>
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono">ID: {runA.test_case_id}</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                              <div className="text-[10px] font-sans text-muted-foreground leading-relaxed bg-black/20 p-2 rounded border border-border/10">
                                <span className="font-semibold text-primary/70 block mb-0.5">User Input:</span>
                                <span className="font-mono text-[9px] whitespace-pre-wrap">{runA.input_text}</span>
                              </div>
                              {runA.expected_behavior && (
                                <div className="text-[10px] font-sans text-muted-foreground leading-relaxed bg-black/10 p-2 rounded border border-border/5">
                                  <span className="font-semibold text-accent/70 block mb-0.5">Expected Behavior / Notes:</span>
                                  <span className="italic text-[9.5px]">{runA.expected_behavior}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Card className={`glass-card shadow-none ${winner === "A" ? "border-indigo-500 bg-indigo-500/5 shadow-md shadow-indigo-500/5" : ""}`}>
                              <CardHeader className="p-3 border-b border-border/50 bg-secondary/10 flex flex-row items-center justify-between select-none font-sans">
                                <span className="text-xs font-bold font-mono">Output A</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] text-muted-foreground font-mono">L: {runA.latency.toFixed(2)}s • T: {runA.token_usage} • ${runA.estimated_cost.toFixed(6)}</span>
                                  {winner === "A" && (
                                    <Badge variant="success" className="text-[8px] font-mono py-0 font-bold">WINNER</Badge>
                                  )}
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => selectRunWinner(index, "A")}
                                    className="h-6 w-6 text-muted-foreground hover:text-accent"
                                  >
                                    <ThumbsUp className="h-3 w-3" />
                                  </Button>
                                </div>
                              </CardHeader>
                              <CardContent className="p-3">
                                {(runA as any).status === "failed" ? (
                                  <div className="text-[10.5px] font-mono text-rose-400 bg-rose-950/30 border border-rose-500/20 p-2.5 rounded-lg">
                                    <span className="font-bold block mb-1">⚠ Execution Failed</span>
                                    {(runA as any).error || "Unknown error occurred."}
                                  </div>
                                ) : (
                                  <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed bg-black/40 p-2.5 rounded-lg overflow-y-auto max-h-[140px] select-text">
                                    {runA.output_text}
                                  </pre>
                                )}
                              </CardContent>
                            </Card>

                            <Card className={`glass-card shadow-none ${winner === "B" ? "border-indigo-500 bg-indigo-500/5 shadow-md shadow-indigo-500/5" : ""}`}>
                              <CardHeader className="p-3 border-b border-border/50 bg-secondary/10 flex flex-row items-center justify-between select-none">
                                <span className="text-xs font-bold font-mono">Output B</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] text-muted-foreground font-mono">L: {runB ? runB.latency.toFixed(2) : 0}s • T: {runB ? runB.token_usage : 0} • ${runB ? runB.estimated_cost.toFixed(6) : 0}</span>
                                  {winner === "B" && (
                                    <Badge variant="success" className="text-[8px] font-mono py-0 font-bold">WINNER</Badge>
                                  )}
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => selectRunWinner(index, "B")}
                                    className="h-6 w-6 text-muted-foreground hover:text-accent"
                                  >
                                    <ThumbsUp className="h-3 w-3" />
                                  </Button>
                                </div>
                              </CardHeader>
                              <CardContent className="p-3">
                                {(runB as any)?.status === "failed" ? (
                                  <div className="text-[10.5px] font-mono text-rose-400 bg-rose-950/30 border border-rose-500/20 p-2.5 rounded-lg">
                                    <span className="font-bold block mb-1">⚠ Execution Failed</span>
                                    {(runB as any).error || "Unknown error occurred."}
                                  </div>
                                ) : (
                                  <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed bg-black/40 p-2.5 rounded-lg overflow-y-auto max-h-[140px] select-text">
                                    {runB ? runB.output_text : ""}
                                  </pre>
                                )}
                              </CardContent>
                            </Card>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-border/10 mt-1 select-none">
                            <div className="flex-1 pr-4">
                              {aiComment && (
                                <p className="text-[10px] text-indigo-400 bg-indigo-500/5 border border-indigo-500/10 px-2.5 py-1.5 rounded-md italic">
                                  <Sparkles className="h-3 w-3 inline mr-1 text-primary animate-pulse" />
                                  <strong>AI Eval:</strong> {aiComment}
                                </p>
                              )}
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => toggleOutputDiff(index)}
                              className="h-7 text-[10px] gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              {showDiff ? "Hide Diff" : "Highlight Diff"}
                            </Button>
                          </div>

                          <AnimatePresence>
                            {showDiff && runB && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden border border-border/60 rounded-lg pt-1"
                              >
                                <PromptDiff original={runA.output_text} modified={runB.output_text} />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  } catch (err: any) {
    console.error("Render crash caught:", err);
    return (
      <div className="p-6 border border-red-500/30 bg-red-500/5 text-red-500 rounded-xl select-text">
        <h3 className="font-bold text-sm">Render Error Caught</h3>
        <p className="text-xs text-muted-foreground mt-1">PromptVault caught an exception during rendering the Compare view:</p>
        <pre className="text-xs font-mono mt-4 p-4 bg-black/40 border border-border/50 rounded-lg whitespace-pre-wrap">
          {err?.stack || err?.message || String(err)}
        </pre>
      </div>
    );
  }
};
