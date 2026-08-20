import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LayoutDashboard, FileCode, Settings, Sun, Moon, Sparkles, 
  Terminal, Activity, Layers, Search, Command, X, ChevronRight, CornerDownLeft, Menu, LogOut, UserCheck
} from "lucide-react";
import { blueprintApi, Blueprint } from "../services/api";
import { Button } from "./ui/Button";
import { useAuth } from "../context/AuthContext";
import { LogoutModal } from "./LogoutModal";

export const Layout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("theme");
    return (saved as "dark" | "light") || "dark";
  });
  const [apiStatus, setApiStatus] = useState<"online" | "offline">("offline");
  
  // Auth state & Logout Modal
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showUserPopover, setShowUserPopover] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const userDisplayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "PromptVault User";
  const userEmail = user?.email || "user@promptvault.io";
  const userInitials = userDisplayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase() || "PV";

  const handleLogout = async () => {
    // 1. Close modal and palette dropdowns immediately
    setShowLogoutModal(false);
    setShowCommandPalette(false);
    
    // 2. Trigger 400ms scale-down (100% -> 98%) and fade-out animation
    setIsLoggingOut(true);

    // 3. Execute async session cleanup concurrently with the 400ms transition
    await Promise.all([
      signOut(),
      new Promise((resolve) => setTimeout(resolve, 400)),
    ]);

    setIsLoggingOut(false);

    // 4. Smoothly navigate to landing page
    navigate("/login", { replace: true });
  };

  // Collapsible Sidebar State
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem("sidebar_collapsed") === "true";
  });

  // Command Palette State
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState("");

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar_collapsed", String(next));
      return next;
    });
  };

  // Check health periodically
  useEffect(() => {
    const checkHealth = () => {
      fetch("http://localhost:8000/health")
        .then((res) => {
          if (res.status === 200) setApiStatus("online");
          else setApiStatus("offline");
        })
        .catch(() => setApiStatus("offline"));
    };
    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard listener for Cmd/Ctrl + K to toggle command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
      if (e.key === "Escape") {
        setShowCommandPalette(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Synchronize CSS themes
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // Query blueprints for the command palette
  const { data: blueprints = [] } = useQuery<Blueprint[]>({
    queryKey: ["blueprints"],
    queryFn: blueprintApi.list,
    enabled: showCommandPalette, // Query only when palette is active
  });

  const menuItems = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Compare Versions", path: "/compare", icon: Layers },
    { name: "Settings", path: "/settings", icon: Settings },
  ];

  // Filter commands and blueprints
  const standardCommands = [
    { name: "Go to Dashboard", action: () => navigate("/"), shortcut: "G D" },
    { name: "Go to Compare Page", action: () => navigate("/compare"), shortcut: "G C" },
    { name: "Go to Settings Page", action: () => navigate("/settings"), shortcut: "G S" },
    { name: "Toggle Theme Mode", action: () => toggleTheme(), shortcut: "T T" },
  ];

  const filteredCommands = standardCommands.filter(cmd => 
    cmd.name.toLowerCase().includes(paletteSearch.toLowerCase())
  );

  const filteredBlueprints = blueprints.filter(bp => 
    bp.name.toLowerCase().includes(paletteSearch.toLowerCase()) ||
    (bp.description || "").toLowerCase().includes(paletteSearch.toLowerCase())
  );

  const handleCommandSelect = (action: () => void) => {
    action();
    setShowCommandPalette(false);
    setPaletteSearch("");
  };

  return (
    <motion.div
      initial={{ opacity: 1, scale: 1 }}
      animate={{
        opacity: isLoggingOut ? 0 : 1,
        scale: isLoggingOut ? 0.98 : 1,
      }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex min-h-screen bg-background text-foreground font-sans relative overflow-hidden"
    >
      {/* Background Dots Overlay & Ambient Radial Glows (Identical to Landing Page) */}
      <div className="absolute inset-0 bg-dot-pattern pointer-events-none opacity-30 z-0" />
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none animate-pulse z-0" />
      <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-3xl pointer-events-none z-0" />

      {/* Sidebar */}
      <aside className={`border-r border-border/70 bg-card/60 backdrop-blur-2xl flex flex-col justify-between z-10 shrink-0 select-none transition-all duration-300 ${
        isCollapsed ? "w-16" : "w-64"
      }`}>
        <div>
          {/* Logo Header with Toggle Button */}
          <div className={`p-4 flex items-center border-b border-border/60 ${
            isCollapsed ? "justify-center" : "justify-between"
          }`}>
            <div className="flex items-center gap-2.5 overflow-hidden">
              <img
                src="/pv-logo.png"
                alt="PromptVault Logo"
                className="w-10 h-10 object-contain flex-shrink-0"
              />
              {!isCollapsed && (
                <div className="truncate">
                  <span className="font-extrabold text-xs tracking-wider uppercase text-gradient">PromptVault</span>
                  <span className="block text-[9px] text-muted-foreground/80 leading-none tracking-widest uppercase truncate font-mono">Version & Compare</span>
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0 rounded-lg"
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.name}
                  to={item.path}
                  title={isCollapsed ? item.name : undefined}
                  className={({ isActive }) =>
                    `flex items-center gap-3 text-xs font-semibold rounded-xl transition-all duration-200 ${
                      isCollapsed ? "justify-center px-0 py-2.5" : "px-3.5 py-2.5"
                    } ${
                      isActive
                        ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 shadow-md shadow-indigo-500/10 font-bold"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                    }`
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!isCollapsed && <span>{item.name}</span>}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-border/60 space-y-3">
          {/* User Avatar Section */}
          <div className="relative">
            {!isCollapsed ? (
              <div 
                onClick={() => setShowUserPopover(prev => !prev)}
                className="flex items-center justify-between p-2 rounded-xl bg-card/40 hover:bg-secondary/50 border border-border/60 cursor-pointer transition-all duration-150 group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 border border-indigo-400/40 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
                    {userInitials}
                  </div>
                  <div className="truncate space-y-0.5">
                    <span className="text-xs font-bold text-foreground group-hover:text-indigo-400 transition-colors block truncate">
                      {userDisplayName}
                    </span>
                    <span className="text-[10px] text-muted-foreground/80 font-mono block truncate">
                      {userEmail}
                    </span>
                  </div>
                </div>
                <UserCheck className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground shrink-0 transition-colors" />
              </div>
            ) : (
              <button
                onClick={() => setShowUserPopover(prev => !prev)}
                className="h-9 w-9 mx-auto rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 border border-indigo-400/40 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm hover:scale-105 transition-transform"
                title={`${userDisplayName} (${userEmail})`}
              >
                {userInitials}
              </button>
            )}

            {/* User Profile Popover / Quick Menu */}
            <AnimatePresence>
              {showUserPopover && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserPopover(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.95 }}
                    transition={{ duration: 0.12 }}
                    className="absolute bottom-full left-0 mb-2 w-56 bg-card/90 backdrop-blur-2xl border border-border/80 rounded-2xl p-1.5 shadow-2xl z-50 divide-y divide-border/40 font-sans"
                  >
                    <div className="p-2.5 space-y-1">
                      <div className="text-xs font-bold text-foreground truncate">{userDisplayName}</div>
                      <div className="text-[10px] text-muted-foreground font-mono truncate">{userEmail}</div>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setShowUserPopover(false);
                          navigate("/settings");
                        }}
                        className="w-full text-left px-2.5 py-1.5 text-xs font-medium rounded-lg hover:bg-secondary/50 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Settings className="h-3.5 w-3.5" />
                        <span>Settings</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowUserPopover(false);
                          setShowLogoutModal(true);
                        }}
                        className="w-full text-left px-2.5 py-1.5 text-xs font-medium rounded-lg hover:bg-rose-500/10 flex items-center gap-2 text-rose-400 hover:text-rose-300 transition-colors"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Logout</span>
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {!isCollapsed ? (
            <>
              <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-card/40 text-[10px] font-semibold border border-border/40">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Activity className="h-3 w-3 text-muted-foreground" />
                  API Server
                </span>
                <span className={`flex items-center gap-1 ${apiStatus === "online" ? "text-emerald-400" : "text-amber-400"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${apiStatus === "online" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"} inline-block`} />
                  {apiStatus.toUpperCase()}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <img
                    src="/pv-logo.png"
                    alt="PromptVault Logo"
                    className="h-6 w-6 object-contain shrink-0"
                  />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">Dev Vault</span>
                </div>
                <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0 rounded-lg">
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 select-none">
              <div 
                className={`h-2 w-2 rounded-full ${apiStatus === "online" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} 
                title={`API Server: ${apiStatus}`}
              />
              <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </div>

        {/* Logout Modal */}
        <LogoutModal
          isOpen={showLogoutModal}
          onClose={() => setShowLogoutModal(false)}
          onConfirm={handleLogout}
          isLoading={isLoggingOut}
        />
      </aside>


      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 z-10">
        {/* Header bar */}
        <header className="h-14 border-b border-border/60 bg-black/30 backdrop-blur-xl px-6 flex items-center justify-between select-none">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground font-semibold uppercase tracking-wider">PromptVault</span>
            <span className="text-muted-foreground/50">/</span>
            <span className="font-semibold text-foreground uppercase tracking-wider">
              {location.pathname === "/" ? "Dashboard" : location.pathname.substring(1).replace("-", " ")}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowCommandPalette(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-muted-foreground bg-card/40 rounded-xl border border-border/60 hover:bg-secondary/40 hover:text-foreground transition-all duration-200"
            >
              <Search className="h-3 w-3" />
              <span>Search Vault</span>
              <kbd className="bg-secondary/80 px-1.5 py-0.5 rounded-md border border-border text-[9px] font-sans flex items-center gap-0.5 select-none">
                <Command className="h-2 w-2" />
                <span>K</span>
              </kbd>
            </button>
          </div>
        </header>

        {/* Content Outlet */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <Outlet />
        </main>
      </div>

      {/* Command Palette Overlay Dialog */}
      <AnimatePresence>
        {showCommandPalette && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-start justify-center z-50 pt-[15vh]">
            <div className="absolute inset-0" onClick={() => setShowCommandPalette(false)} />
            
            <motion.div
              initial={{ scale: 0.97, y: -8, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.97, y: -8, opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="relative w-full max-w-lg bg-card/90 backdrop-blur-2xl border border-border/80 rounded-2xl overflow-hidden shadow-2xl z-55 flex flex-col"
            >
              {/* Search Bar Input */}
              <div className="flex items-center px-4 border-b border-border/50">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  autoFocus
                  value={paletteSearch}
                  onChange={(e) => setPaletteSearch(e.target.value)}
                  placeholder="Type a command or search prompt blueprints..."
                  className="w-full bg-transparent px-3 py-3.5 text-xs focus:outline-none placeholder:text-muted-foreground/60 text-foreground"
                />
                <button 
                  onClick={() => setShowCommandPalette(false)}
                  className="h-5 w-5 rounded-md bg-secondary/50 border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>

              {/* Selection Results Box */}
              <div className="max-h-[300px] overflow-y-auto p-2 divide-y divide-border/20">
                {/* Blueprints Section */}
                {filteredBlueprints.length > 0 && (
                  <div className="py-2">
                    <span className="px-3 text-[9px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Blueprints</span>
                    {filteredBlueprints.map((bp) => (
                      <button
                        key={bp.id}
                        onClick={() => handleCommandSelect(() => navigate(`/editor?id=${bp.id}`))}
                        className="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-secondary/40 flex items-center justify-between text-muted-foreground hover:text-foreground group"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileCode className="h-3.5 w-3.5 text-indigo-400 group-hover:text-indigo-300 shrink-0" />
                          <span className="font-medium truncate">{bp.name}</span>
                        </div>
                        <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Commands Section */}
                {filteredCommands.length > 0 && (
                  <div className="py-2">
                    <span className="px-3 text-[9px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Actions</span>
                    {filteredCommands.map((cmd) => (
                      <button
                        key={cmd.name}
                        onClick={() => handleCommandSelect(cmd.action)}
                        className="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-secondary/40 flex items-center justify-between text-muted-foreground hover:text-foreground group"
                      >
                        <div className="flex items-center gap-2">
                          <Command className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
                          <span>{cmd.name}</span>
                        </div>
                        <kbd className="text-[9px] bg-secondary/80 border border-border/60 px-1.5 py-0.5 rounded-md font-sans text-muted-foreground">
                          {cmd.shortcut}
                        </kbd>
                      </button>
                    ))}
                  </div>
                )}

                {filteredCommands.length === 0 && filteredBlueprints.length === 0 && (
                  <div className="text-center py-6 text-xs text-muted-foreground">
                    No results found matching your search.
                  </div>
                )}
              </div>

              {/* Bottom Instructions Panel */}
              <div className="flex items-center justify-between bg-secondary/20 border-t border-border/50 px-4 py-2 text-[10px] text-muted-foreground select-none">
                <div className="flex gap-3">
                  <span className="flex items-center gap-1"><CornerDownLeft className="h-2.5 w-2.5" /> Select</span>
                  <span><kbd className="bg-secondary/80 px-1 py-0.5 border border-border rounded text-[9px]">Esc</kbd> Close</span>
                </div>
                <span>Ctrl+K</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
