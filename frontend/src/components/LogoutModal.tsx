import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, X } from "lucide-react";
import { Button } from "./ui/Button";

interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export const LogoutModal: React.FC<LogoutModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="absolute inset-0" onClick={onClose} />
          
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="relative bg-card border border-border rounded-xl w-full max-w-sm p-6 shadow-2xl z-55 flex flex-col font-sans select-none"
          >
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h3 className="font-bold text-sm tracking-tight text-foreground flex items-center gap-2">
                <LogOut className="h-4 w-4 text-rose-500" />
                Log out?
              </h3>
              <button 
                onClick={onClose}
                disabled={isLoading}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="py-4 text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to log out of your PromptVault workspace? Your sessions and blueprints remain safely stored in your vault.
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/50">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={isLoading}
                className="h-8 text-xs px-3 font-semibold"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={onConfirm}
                isLoading={isLoading}
                disabled={isLoading}
                className="h-8 text-xs px-4 bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-md"
              >
                Logout
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
