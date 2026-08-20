import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MessageSquare, Send, Trash2, Save, X, Sparkles, User, Bot, 
  Clock, Cpu, Layers, AlertCircle, Copy, Check, RotateCcw, AlertTriangle, 
  Download, RefreshCw
} from "lucide-react";
import { playgroundApi, PlaygroundMessage, Version } from "../services/api";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { getVersionLabel } from "../utils/date";

interface PromptPlaygroundModalProps {
  isOpen: boolean;
  onClose: () => void;
  blueprintName: string;
  blueprintId: number;
  versions?: Version[];
  selectedVersion?: Version | null;
  onSelectVersion?: (ver: Version) => void;
  isDraft?: boolean;
  systemPrompt: string;
  userPrompt: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
}

export const PromptPlaygroundModal: React.FC<PromptPlaygroundModalProps> = ({
  isOpen,
  onClose,
  blueprintName,
  blueprintId,
  versions = [],
  selectedVersion,
  onSelectVersion,
  isDraft = false,
  systemPrompt,
  userPrompt,
  modelName,
  temperature,
  maxTokens,
}) => {
  const [activeVer, setActiveVer] = useState<Version | null>(selectedVersion || null);
  const [messages, setMessages] = useState<PlaygroundMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Version Switch Confirmation Modal state
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [pendingVersion, setPendingVersion] = useState<Version | null>(null);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync activeVer with selectedVersion when prop changes
  useEffect(() => {
    if (selectedVersion && selectedVersion.id !== activeVer?.id) {
      if (messages.length > 0) {
        setPendingVersion(selectedVersion);
        setShowSwitchModal(true);
      } else {
        setActiveVer(selectedVersion);
      }
    }
  }, [selectedVersion]);

  // Auto scroll to bottom of chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading, errorMessage]);

  // Focus textarea when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const activeLabel = isDraft ? "Draft Version" : getVersionLabel(activeVer?.version_number);
  const activeSysPrompt = isDraft ? systemPrompt : (activeVer?.system_prompt ?? systemPrompt);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleSelectVersionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const targetId = parseInt(e.target.value);
    const ver = versions.find(v => v.id === targetId);
    if (!ver || ver.id === activeVer?.id) return;

    if (messages.length > 0) {
      setPendingVersion(ver);
      setShowSwitchModal(true);
    } else {
      confirmVersionSwitch(ver);
    }
  };

  const confirmVersionSwitch = (targetVer: Version) => {
    setActiveVer(targetVer);
    setMessages([]); // Clear previous conversation history to prevent mixing contexts
    setShowSwitchModal(false);
    setPendingVersion(null);
    if (onSelectVersion) {
      onSelectVersion(targetVer);
    }
    triggerToast(`Switched to ${getVersionLabel(targetVer.version_number)}. Started a new conversation.`);
  };

  const cancelVersionSwitch = () => {
    setShowSwitchModal(false);
    setPendingVersion(null);
  };

  const handleSend = async () => {
    const text = inputMessage.trim();
    if (!text || isLoading) return;

    const userMsg: PlaygroundMessage = {
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputMessage("");
    setIsLoading(true);
    setErrorMessage(null);

    await executeCompletion(newMessages);
  };

  const executeCompletion = async (currentMessages: PlaygroundMessage[]) => {
    try {
      const res = await playgroundApi.chat({
        blueprint_id: blueprintId,
        version_id: isDraft ? undefined : activeVer?.id,
        is_draft: isDraft,
        draft_system_prompt: activeSysPrompt,
        draft_user_prompt: userPrompt,
        messages: currentMessages.map(m => ({ role: m.role, content: m.content })),
        model: modelName,
        temperature,
        max_tokens: maxTokens,
      });

      const aiMsg: PlaygroundMessage = {
        role: "assistant",
        content: res.content,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        latency: res.latency,
        tokens: res.tokens
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message;
      if (err?.response?.status === 400 && detail === "AI provider is not configured.") {
        setErrorMessage("AI provider is not configured.");
      } else {
        setErrorMessage(detail || "Failed to communicate with AI model. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (messages.length === 0 || isLoading) return;

    // Remove last assistant message if present
    let history = [...messages];
    if (history[history.length - 1].role === "assistant") {
      history.pop();
    }

    if (history.length === 0) return;

    setMessages(history);
    setIsLoading(true);
    setErrorMessage(null);
    await executeCompletion(history);
    triggerToast("Regenerated response.");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setErrorMessage(null);
    triggerToast("Conversation reset.");
  };

  const handleSaveConversation = async () => {
    if (messages.length === 0) {
      triggerToast("No conversation messages to save.");
      return;
    }

    try {
      await playgroundApi.save({
        blueprint_id: blueprintId,
        version_id: activeVer?.id,
        version_label: activeLabel,
        messages: messages.map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp })),
        model: modelName,
        temperature,
        max_tokens: maxTokens
      });
      triggerToast(`Playground conversation saved (${messages.length} messages).`);
    } catch (err) {
      triggerToast("Failed to save conversation session.");
    }
  };

  const handleExportConversation = () => {
    if (messages.length === 0) {
      triggerToast("No conversation messages to export.");
      return;
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(
      JSON.stringify({
        blueprint_name: blueprintName,
        blueprint_id: blueprintId,
        version_label: activeLabel,
        system_prompt: activeSysPrompt,
        model: modelName,
        temperature,
        max_tokens: maxTokens,
        exported_at: new Date().toISOString(),
        messages: messages
      }, null, 2)
    );

    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `Playground_${blueprintName.replace(/\s+/g, "_")}_${activeLabel}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    triggerToast("Exported conversation as JSON.");
  };

  const handleCopyMessage = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Helper for rendering formatted content (handling code blocks gracefully)
  const renderMessageContent = (content: string) => {
    const codeBlockRegex = /```([a-zA-Z0-9]*)\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', value: content.substring(lastIndex, match.index) });
      }
      parts.push({ type: 'code', lang: match[1] || 'code', value: match[2].trim() });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push({ type: 'text', value: content.substring(lastIndex) });
    }

    return (
      <div className="space-y-2">
        {parts.map((p, i) => {
          if (p.type === 'code') {
            return (
              <div key={i} className="my-2 rounded-lg bg-black/70 border border-border/40 overflow-hidden font-mono text-[11px]">
                <div className="px-3 py-1 bg-secondary/30 border-b border-border/30 flex items-center justify-between text-[10px] text-muted-foreground select-none">
                  <span>{p.lang}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(p.value)}
                    className="hover:text-foreground flex items-center gap-1"
                  >
                    <Copy className="h-3 w-3" /> Copy
                  </button>
                </div>
                <pre className="p-3 text-emerald-400 overflow-x-auto whitespace-pre leading-relaxed">{p.value}</pre>
              </div>
            );
          }
          return <p key={i} className="whitespace-pre-wrap leading-relaxed">{p.value}</p>;
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in select-none">
      
      {/* Toast Alert */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 right-6 z-60 bg-neutral-900 border border-neutral-800 text-white px-4 py-2.5 rounded-lg shadow-2xl text-xs flex items-center gap-2"
          >
            <Sparkles className="h-4 w-4 text-indigo-400" />
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* VERSION SWITCH CONFIRMATION MODAL */}
      <AnimatePresence>
        {showSwitchModal && pendingVersion && (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 10 }}
              className="bg-card border border-amber-500/40 p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4 font-sans"
            >
              <div className="flex items-center gap-3 text-amber-400">
                <AlertTriangle className="h-6 w-6 shrink-0 animate-pulse" />
                <h3 className="text-base font-bold text-foreground">Switch Prompt Version?</h3>
              </div>
              <p className="text-xs text-slate-300 dark:text-zinc-300 leading-relaxed">
                You switched from <strong className="text-indigo-400">{activeLabel}</strong> to <strong className="text-emerald-400">{getVersionLabel(pendingVersion.version_number)}</strong>.
                <br /><br />
                Start a new conversation using {getVersionLabel(pendingVersion.version_number)}?
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancelVersionSwitch}
                  className="h-8 text-xs px-3"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => confirmVersionSwitch(pendingVersion)}
                  className="h-8 text-xs px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                >
                  Start New Conversation
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MAIN PLAYGROUND MODAL CONTAINER */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="w-full max-w-4xl h-[88vh] glass-card border border-border/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden bg-card/95"
      >
        {/* Header */}
        <div className="p-4 border-b border-border/50 bg-secondary/30 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">Prompt Playground</h2>
                <Badge variant="outline" className="text-[9px] border-indigo-500/40 text-indigo-300 font-mono py-0 font-bold bg-indigo-500/10">
                  {isDraft ? "DRAFT MODE" : "LIVE INTERACTIVE CHAT"}
                </Badge>
              </div>
              <p className="text-xs text-slate-300 dark:text-zinc-300 font-sans">
                Test the currently selected prompt version in real time.
              </p>
            </div>
          </div>

          {/* Version Selector Dropdown & Badges */}
          <div className="flex items-center gap-3">
            {!isDraft && versions.length > 0 && (
              <div className="flex items-center gap-1.5 bg-secondary/40 border border-indigo-500/30 px-2.5 py-1 rounded-xl">
                <span className="text-[10px] text-muted-foreground font-mono font-semibold">Version:</span>
                <select
                  value={activeVer?.id || ""}
                  onChange={handleSelectVersionChange}
                  className="bg-transparent text-indigo-300 font-mono font-bold text-xs outline-none cursor-pointer"
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.id} className="bg-card text-foreground">
                      {getVersionLabel(v.version_number)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="hidden md:flex items-center gap-2 font-mono text-[10px]">
              <Badge variant="secondary" className="gap-1 font-semibold">
                <Layers className="h-3 w-3 text-purple-400" /> {blueprintName}
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Cpu className="h-3 w-3 text-sky-400" /> {modelName}
              </Badge>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Close Playground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile metadata row */}
        <div className="md:hidden px-4 py-2 border-b border-border/40 bg-secondary/15 flex items-center justify-between text-[10px] font-mono select-none">
          <span>{blueprintName} • <strong className="text-indigo-400">{activeLabel}</strong></span>
          <span>{modelName} (T:{temperature})</span>
        </div>

        {/* Chat Messages Body */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 font-sans select-text bg-black/20"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 select-none">
              <div className="h-16 w-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4 animate-pulse">
                <Sparkles className="h-8 w-8" />
              </div>
              <h3 className="text-sm font-bold text-foreground">Ready to Chat with {activeLabel}</h3>
              <p className="text-xs text-slate-300 dark:text-zinc-400 mt-1 max-w-sm leading-relaxed">
                Enter your test message below to evaluate how your active system prompt responds before saving or committing.
              </p>
              <div className="mt-4 p-3 rounded-xl bg-secondary/20 border border-border/40 text-[11px] font-mono text-muted-foreground max-w-md text-left">
                <span className="text-indigo-400 font-bold block mb-1">Active System Directive ({activeLabel}):</span>
                <p className="line-clamp-3 italic text-foreground/90 whitespace-pre-wrap">
                  {activeSysPrompt || "No system prompt configured."}
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isUser = msg.role === "user";
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                >
                  {!isUser && (
                    <div className="h-7 w-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}

                  <div className={`flex flex-col space-y-1 max-w-[82%] ${isUser ? "items-end" : "items-start"}`}>
                    <div className="flex items-center gap-2 px-1 select-none">
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {isUser ? "You" : `AI (${activeLabel})`}
                      </span>
                      {msg.timestamp && (
                        <span className="text-[9px] text-muted-foreground/60 font-mono">
                          {msg.timestamp}
                        </span>
                      )}
                    </div>

                    <div
                      className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                        isUser
                          ? "bg-indigo-600/30 border border-indigo-500/40 text-white rounded-tr-xs shadow-md"
                          : "bg-secondary/40 border border-border/60 text-slate-100 rounded-tl-xs shadow-md"
                      }`}
                    >
                      {renderMessageContent(msg.content)}
                    </div>

                    {!isUser && (
                      <div className="flex items-center gap-3 px-1 text-[9.5px] text-muted-foreground/70 font-mono select-none">
                        {msg.latency && (
                          <span>Latency: <strong className="text-foreground/80">{msg.latency.toFixed(2)}s</strong></span>
                        )}
                        {msg.tokens && (
                          <span>Tokens: <strong className="text-foreground/80">{msg.tokens}</strong></span>
                        )}
                        <button
                          onClick={() => handleCopyMessage(msg.content, idx)}
                          className="hover:text-foreground flex items-center gap-1 transition-colors ml-1"
                          title="Copy response"
                        >
                          {copiedIndex === idx ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </div>
                    )}
                  </div>

                  {isUser && (
                    <div className="h-7 w-7 rounded-lg bg-secondary/80 border border-border/60 flex items-center justify-center text-foreground shrink-0 mt-0.5">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </motion.div>
              );
            })
          )}

          {/* Typing Loading Indicator */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3 justify-start"
            >
              <div className="h-7 w-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                <Bot className="h-4 w-4 animate-bounce" />
              </div>
              <div className="bg-secondary/40 border border-border/60 rounded-2xl rounded-tl-xs p-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-indigo-500 animate-ping" />
                <span className="text-xs text-slate-300 font-mono animate-pulse">Generating response using {activeLabel}...</span>
              </div>
            </motion.div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-sans flex items-center gap-2 select-none">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Input Controls Footer */}
        <div className="p-4 border-t border-border/50 bg-secondary/20 flex flex-col gap-3 shrink-0 select-none">
          <div className="flex items-center gap-2">
            <textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              rows={2}
              disabled={isLoading}
              className="flex-1 bg-card/60 border border-border/60 focus:border-indigo-500 rounded-xl p-3 text-xs text-foreground placeholder:text-muted-foreground/60 resize-none outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all font-sans select-text disabled:opacity-50"
            />
            <Button
              onClick={handleSend}
              disabled={isLoading || !inputMessage.trim()}
              className="h-full px-5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold gap-2 rounded-xl text-xs shrink-0 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              Send
            </Button>
          </div>

          <div className="flex items-center justify-between text-xs pt-1 border-t border-border/20">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearChat}
                disabled={messages.length === 0}
                className="h-7 text-[11px] gap-1.5 text-muted-foreground hover:text-foreground"
                title="Reset conversation"
              >
                <RotateCcw className="h-3 w-3" />
                New Conversation
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRegenerate}
                disabled={messages.length === 0 || isLoading}
                className="h-7 text-[11px] gap-1.5 text-muted-foreground hover:text-indigo-300"
                title="Regenerate last response"
              >
                <RefreshCw className="h-3 w-3" />
                Regenerate
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearChat}
                disabled={messages.length === 0}
                className="h-7 text-[11px] gap-1.5 text-muted-foreground hover:text-rose-400"
                title="Clear all messages"
              >
                <Trash2 className="h-3 w-3" />
                Clear Chat
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExportConversation}
                disabled={messages.length === 0}
                className="h-7 text-[11px] gap-1.5 text-muted-foreground hover:text-foreground"
                title="Export conversation history"
              >
                <Download className="h-3 w-3" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveConversation}
                disabled={messages.length === 0}
                className="h-7 text-[11px] gap-1.5 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10"
                title="Save conversation session to database"
              >
                <Save className="h-3 w-3" />
                Save Session
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
