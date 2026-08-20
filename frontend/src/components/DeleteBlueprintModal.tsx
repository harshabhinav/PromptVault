import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Trash2, X, Loader2 } from "lucide-react";
import { Button } from "./ui/Button";

export interface DeleteBlueprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  blueprintName: string;
  isDeleting: boolean;
  errorMessage?: string | null;
}

export const DeleteBlueprintModal: React.FC<DeleteBlueprintModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  blueprintName,
  isDeleting,
  errorMessage,
}) => {
  // ESC key handler for accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isDeleting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isDeleting, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none font-sans"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-blueprint-title"
          aria-describedby="delete-blueprint-description"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!isDeleting) onClose();
            }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ type: "spring", duration: 0.25, bounce: 0.1 }}
            className="relative w-full max-w-md bg-neutral-900/95 backdrop-blur-2xl border border-rose-500/30 rounded-2xl p-6 shadow-2xl z-10 space-y-5 overflow-hidden"
          >
            {/* Background Red Ambient Glow */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header / Title */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shrink-0 shadow-lg shadow-rose-500/10">
                  <AlertTriangle className="h-5 w-5" strokeWidth={2.2} />
                </div>
                <div>
                  <h2 
                    id="delete-blueprint-title"
                    className="text-lg font-black tracking-tight text-foreground"
                  >
                    Delete Blueprint?
                  </h2>
                  <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Permanent Action</span>
                </div>
              </div>

              <button
                onClick={onClose}
                disabled={isDeleting}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-secondary/40 transition-colors disabled:opacity-50 cursor-pointer"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Message Body */}
            <div className="space-y-2">
              <p 
                id="delete-blueprint-description"
                className="text-xs text-muted-foreground leading-relaxed"
              >
                Are you sure you want to delete <strong className="text-foreground font-semibold">"{blueprintName}"</strong>? This action cannot be undone and will permanently remove all associated version history and evaluation test runs.
              </p>

              {errorMessage && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/40">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isDeleting}
                className="h-9 px-4 text-xs font-semibold border-border/60 bg-secondary/20 hover:bg-secondary/60 text-foreground cursor-pointer"
              >
                Cancel
              </Button>

              <Button
                type="button"
                onClick={onConfirm}
                disabled={isDeleting}
                className="h-9 px-4 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20 hover:shadow-rose-600/30 flex items-center gap-2 cursor-pointer transition-all duration-150"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete</span>
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
