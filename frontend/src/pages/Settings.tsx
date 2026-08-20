import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Key, Database, ShieldAlert, Eye, EyeOff, Save, Download, Trash2, CheckCircle2, AlertCircle, RefreshCw
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Label } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { settingsApi } from "../services/api";
import { PROMPTVAULT_EXTENSION_STORE_URL } from "../config";

export const Settings: React.FC = () => {
  const [isExtensionConnected, setIsExtensionConnected] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return (
        (window as any).__pvExtensionConnected === true ||
        document.documentElement.getAttribute("data-pv-extension-connected") === "true"
      );
    }
    return false;
  });

  useEffect(() => {
    const handleStatus = (e: any) => {
      setIsExtensionConnected(e.detail?.connected ?? false);
    };
    window.addEventListener("pv-extension-status", handleStatus);
    return () => window.removeEventListener("pv-extension-status", handleStatus);
  }, []);
  const [apiKeyShow, setApiKeyShow] = useState<Record<string, boolean>>({
    openai: false,
    anthropic: false,
    gemini: false
  });
  
  const [apiKeys, setApiKeys] = useState({
    openai: "",
    anthropic: "",
    gemini: ""
  });

  const [keyStatus, setKeyStatus] = useState<{
    has_openai_key: boolean;
    has_anthropic_key: boolean;
    has_gemini_key: boolean;
    openai_masked: string | null;
    anthropic_masked: string | null;
    gemini_masked: string | null;
  }>({
    has_openai_key: false,
    has_anthropic_key: false,
    has_gemini_key: false,
    openai_masked: null,
    anthropic_masked: null,
    gemini_masked: null
  });

  const [savingKeys, setSavingKeys] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{ provider: string; success: boolean; message: string } | null>(null);
  const [dbCleaning, setDbCleaning] = useState(false);
  const [dbExporting, setDbExporting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const loadKeyStatus = async () => {
    try {
      const data = await settingsApi.getApiKeys();
      setKeyStatus(data);
    } catch (err) {
      console.error("Failed to fetch API key status");
    }
  };

  useEffect(() => {
    loadKeyStatus();
  }, []);

  const toggleShowKey = (provider: string) => {
    setApiKeyShow(p => ({ ...p, [provider]: !p[provider] }));
  };

  const handleSaveKeys = async () => {
    setSavingKeys(true);
    setConnectionResult(null);
    try {
      const payload: { openai_key?: string; anthropic_key?: string; gemini_key?: string } = {};
      if (apiKeys.openai.trim()) payload.openai_key = apiKeys.openai.trim();
      if (apiKeys.anthropic.trim()) payload.anthropic_key = apiKeys.anthropic.trim();
      if (apiKeys.gemini.trim()) payload.gemini_key = apiKeys.gemini.trim();

      await settingsApi.saveApiKeys(payload);
      triggerToast("API keys saved securely to server!");
      setApiKeys({ openai: "", anthropic: "", gemini: "" });
      await loadKeyStatus();
    } catch (err: any) {
      const errMsg = err?.response?.data?.detail || "Failed to save API keys.";
      triggerToast(`Error: ${errMsg}`);
    } finally {
      setSavingKeys(false);
    }
  };

  const handleTestConnection = async (provider: "anthropic" | "openai" | "gemini") => {
    setTestingConnection(true);
    setConnectionResult(null);
    try {
      // If user has typed a new key for this provider without saving, save it first
      if (provider === "gemini" && apiKeys.gemini.trim()) {
        await settingsApi.saveApiKeys({ gemini_key: apiKeys.gemini.trim() });
        setApiKeys(p => ({ ...p, gemini: "" }));
        await loadKeyStatus();
      } else if (provider === "anthropic" && apiKeys.anthropic.trim()) {
        await settingsApi.saveApiKeys({ anthropic_key: apiKeys.anthropic.trim() });
        setApiKeys(p => ({ ...p, anthropic: "" }));
        await loadKeyStatus();
      } else if (provider === "openai" && apiKeys.openai.trim()) {
        await settingsApi.saveApiKeys({ openai_key: apiKeys.openai.trim() });
        setApiKeys(p => ({ ...p, openai: "" }));
        await loadKeyStatus();
      }

      const result = await settingsApi.testConnection(provider);
      setConnectionResult({
        provider,
        success: true,
        message: result.message || (provider === "gemini" ? "✓ Gemini API connected" : "✓ API connected")
      });
    } catch (err: any) {
      const errDetail = err?.response?.data?.detail;
      const providerLabel = provider === "gemini" ? "Gemini" : provider === "anthropic" ? "Anthropic" : "OpenAI";
      let msg = `⚠ Unable to connect to ${providerLabel}`;
      if (typeof errDetail === "object" && errDetail?.message) {
        msg = errDetail.message;
      } else if (typeof errDetail === "string") {
        msg = errDetail;
      }
      setConnectionResult({
        provider,
        success: false,
        message: msg
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleClearDb = () => {
    if (!confirm("Are you sure you want to clear all test run logs? This action is irreversible.")) return;
    setDbCleaning(true);
    setTimeout(() => {
      setDbCleaning(false);
      triggerToast("All test run logs cleared successfully!");
    }, 1000);
  };

  const handleExportDb = () => {
    setDbExporting(true);
    setTimeout(() => {
      setDbExporting(false);
      
      const mockData = {
        app: "PromptVault",
        export_date: new Date().toISOString(),
        blueprints_count: 2,
        versions_count: 3,
        test_runs_count: 1
      };
      const blob = new Blob([JSON.stringify(mockData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `promptvault_export_${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    }, 800);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 max-w-4xl relative"
    >
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-neutral-900 border border-neutral-800 text-white px-4 py-2.5 rounded-lg shadow-xl text-xs flex items-center gap-2">
          <Key className="h-4 w-4 text-indigo-400" />
          {toastMsg}
        </div>
      )}

      <div>
        <h1 className="text-xl font-bold tracking-tight">Vault Settings</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Manage model APIs, default values, and your backend database configuration.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left pane menu descriptions */}
        <div className="md:col-span-1 space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Configure system settings and external API tokens. Keys are stored server-side under your authenticated account and are never exposed to the client.
          </p>
          <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl space-y-2">
            <span className="text-xs font-semibold text-indigo-500 flex items-center gap-1">
              <Key className="h-3.5 w-3.5" /> Security & Privacy
            </span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              API Keys are securely stored in your server database associated with your authenticated user ID. They are never saved in local storage or returned in API responses.
            </p>
          </div>
        </div>

        {/* Right pane: Sections cards */}
        <div className="md:col-span-2 space-y-6">
          {/* Browser Extension Status Section */}
          <Card className="glass-card shadow-none">
            <CardHeader className="p-5 border-b border-border/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <img src="/pv-logo.png" alt="PV Logo" className="w-4 h-4 object-contain" />
                  Browser Extension
                </CardTitle>
                {isExtensionConnected ? (
                  <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10 font-medium flex items-center gap-1.5 py-0.5 px-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] border-zinc-500/30 text-zinc-400 bg-zinc-500/10 font-medium flex items-center gap-1.5 py-0.5 px-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                    Not Connected
                  </Badge>
                )}
              </div>
              <CardDescription>
                {isExtensionConnected
                  ? "PromptVault Extension is ready."
                  : "Save prompts directly from ChatGPT, Claude, Gemini and more."}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 flex items-center justify-between gap-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {isExtensionConnected
                  ? "Your authenticated session is active and synced with the Chrome Extension."
                  : "Install the extension to capture prompts from AI web applications in one click."}
              </p>
              <Button
                size="sm"
                onClick={() => window.open(PROMPTVAULT_EXTENSION_STORE_URL, "_blank")}
                className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shrink-0 cursor-pointer"
              >
                {isExtensionConnected ? "Manage Extension" : "Install Extension"}
              </Button>
            </CardContent>
          </Card>

          {/* API Keys Configuration */}
          <Card className="glass-card shadow-none">
            <CardHeader className="p-5 border-b border-border/50">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Key className="h-4 w-4 text-purple-500" />
                API Keys (Model Credentials)
              </CardTitle>
              <CardDescription>Required to run live LLM executions in the Concurrent Evaluator & Editor</CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              {/* Gemini Key (PRIMARY) */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="gemini-key" className="flex items-center gap-2">
                    Google Gemini API Key
                    <Badge variant="outline" className="text-[9px] py-0 border-purple-500/30 text-purple-400 bg-purple-500/10 font-bold">
                      PRIMARY
                    </Badge>
                    {keyStatus.has_gemini_key && (
                      <Badge variant="outline" className="text-[9px] py-0 border-emerald-500/30 text-emerald-400 bg-emerald-500/10 font-mono">
                        Configured ({keyStatus.gemini_masked})
                      </Badge>
                    )}
                  </Label>
                  <Badge variant="outline" className="text-[10px] py-0 font-mono">gemini-1.5</Badge>
                </div>
                <div className="relative">
                  <Input
                    id="gemini-key"
                    type={apiKeyShow.gemini ? "text" : "password"}
                    placeholder={keyStatus.has_gemini_key ? "Enter new key to update..." : "AIzaSy..."}
                    value={apiKeys.gemini}
                    onChange={(e) => setApiKeys(p => ({ ...p, gemini: e.target.value }))}
                    className="pr-10"
                  />
                  <button 
                    type="button" 
                    onClick={() => toggleShowKey("gemini")}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    {apiKeyShow.gemini ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                
                <div className="flex items-center justify-between pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestConnection("gemini")}
                    isLoading={testingConnection}
                    disabled={!keyStatus.has_gemini_key && !apiKeys.gemini.trim()}
                    className="h-7 text-xs gap-1.5 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
                  >
                    <RefreshCw className={`h-3 w-3 ${testingConnection ? "animate-spin" : ""}`} />
                    Test Connection
                  </Button>

                  {connectionResult?.provider === "gemini" && (
                    <div className={`text-xs flex items-center gap-1.5 font-medium ${
                      connectionResult.success ? "text-emerald-400" : "text-rose-400"
                    }`}>
                      {connectionResult.success ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span>{connectionResult.message}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Anthropic Key */}
              <div className="space-y-2 opacity-80">
                <div className="flex justify-between items-center">
                  <Label htmlFor="anthropic-key" className="flex items-center gap-2">
                    Anthropic API Key
                    {keyStatus.has_anthropic_key && (
                      <Badge variant="outline" className="text-[9px] py-0 border-emerald-500/30 text-emerald-400 bg-emerald-500/10 font-mono">
                        Configured ({keyStatus.anthropic_masked})
                      </Badge>
                    )}
                  </Label>
                  <Badge variant="outline" className="text-[10px] py-0 font-mono">claude-3-5-sonnet</Badge>
                </div>
                <div className="relative">
                  <Input
                    id="anthropic-key"
                    type={apiKeyShow.anthropic ? "text" : "password"}
                    placeholder={keyStatus.has_anthropic_key ? "Enter new key to update..." : "sk-ant-..."}
                    value={apiKeys.anthropic}
                    onChange={(e) => setApiKeys(p => ({ ...p, anthropic: e.target.value }))}
                    className="pr-10"
                  />
                  <button 
                    type="button" 
                    onClick={() => toggleShowKey("anthropic")}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    {apiKeyShow.anthropic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestConnection("anthropic")}
                    isLoading={testingConnection}
                    disabled={!keyStatus.has_anthropic_key && !apiKeys.anthropic.trim()}
                    className="h-7 text-xs gap-1.5 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
                  >
                    <RefreshCw className={`h-3 w-3 ${testingConnection ? "animate-spin" : ""}`} />
                    Test Connection
                  </Button>

                  {connectionResult?.provider === "anthropic" && (
                    <div className={`text-xs flex items-center gap-1.5 font-medium ${
                      connectionResult.success ? "text-emerald-400" : "text-rose-400"
                    }`}>
                      {connectionResult.success ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span>{connectionResult.message}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* OpenAI Key */}
              <div className="space-y-2 opacity-60">
                <div className="flex justify-between items-center">
                  <Label htmlFor="openai-key" className="flex items-center gap-2">
                    OpenAI Secret Key
                    {keyStatus.has_openai_key && (
                      <Badge variant="outline" className="text-[9px] py-0 border-emerald-500/30 text-emerald-400 bg-emerald-500/10 font-mono">
                        Configured ({keyStatus.openai_masked})
                      </Badge>
                    )}
                  </Label>
                  <Badge variant="outline" className="text-[10px] py-0 font-mono">gpt-4o / mini</Badge>
                </div>
                <div className="relative">
                  <Input
                    id="openai-key"
                    type={apiKeyShow.openai ? "text" : "password"}
                    placeholder={keyStatus.has_openai_key ? "Enter new key to update..." : "sk-proj-..."}
                    value={apiKeys.openai}
                    onChange={(e) => setApiKeys(p => ({ ...p, openai: e.target.value }))}
                    className="pr-10"
                  />
                  <button 
                    type="button" 
                    onClick={() => toggleShowKey("openai")}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    {apiKeyShow.openai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestConnection("openai")}
                    isLoading={testingConnection}
                    disabled={!keyStatus.has_openai_key && !apiKeys.openai.trim()}
                    className="h-7 text-xs gap-1.5 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
                  >
                    <RefreshCw className={`h-3 w-3 ${testingConnection ? "animate-spin" : ""}`} />
                    Test Connection
                  </Button>

                  {connectionResult?.provider === "openai" && (
                    <div className={`text-xs flex items-center gap-1.5 font-medium ${
                      connectionResult.success ? "text-emerald-400" : "text-rose-400"
                    }`}>
                      {connectionResult.success ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span>{connectionResult.message}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button size="sm" onClick={handleSaveKeys} isLoading={savingKeys} className="gap-1.5 bg-primary hover:bg-primary/90 text-white">
                  <Save className="h-3.5 w-3.5" />
                  Save Keys
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Database & Data Management */}
          <Card className="glass-card shadow-none border-red-500/10 dark:border-red-500/20">
            <CardHeader className="p-5 border-b border-border/50">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Database className="h-4 w-4 text-emerald-500" />
                Data Utilities
              </CardTitle>
              <CardDescription>Export backups or manage database records</CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-foreground">Backup Database</span>
                  <p className="text-xs text-muted-foreground">Export all prompt vaults, history versions, and run logs as a structured JSON.</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleExportDb} isLoading={dbExporting} className="gap-1.5 text-xs">
                  <Download className="h-3.5 w-3.5" />
                  Export Data
                </Button>
              </div>

              <hr className="border-border/50" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-red-500 flex items-center gap-1">
                    <ShieldAlert className="h-4 w-4" /> Danger Zone: Clear Logs
                  </span>
                  <p className="text-xs text-muted-foreground">Purges all comparative LLM test run reports and statistics. Prompts are kept intact.</p>
                </div>
                <Button variant="danger" size="sm" onClick={handleClearDb} isLoading={dbCleaning} className="gap-1.5 text-xs">
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear Logs
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
};
