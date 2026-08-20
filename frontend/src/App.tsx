import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { BlueprintEditor } from "./pages/BlueprintEditor";
import { Compare } from "./pages/Compare";
import { Settings } from "./pages/Settings";
import { Login } from "./pages/Login";
import { SignUp } from "./pages/SignUp";

// Instantiate the TanStack Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Minimal loading placeholder during initial session hydration
const LoadingScreen: React.FC = () => (
  <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center font-sans select-none relative overflow-hidden">
    <div className="absolute inset-0 bg-dot-pattern opacity-30 pointer-events-none" />
    <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 animate-pulse">
      <Sparkles className="h-5 w-5" />
    </div>
  </div>
);

// ProtectedRoute: Redirects unauthenticated users to /login
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

// PublicOnlyRoute: Redirects authenticated users directly to Dashboard /
const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Auth Routes */}
            <Route
              path="/login"
              element={
                <PublicOnlyRoute>
                  <Login />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/signup"
              element={
                <PublicOnlyRoute>
                  <Login initialMode="signup" />
                </PublicOnlyRoute>
              }
            />

            {/* Protected Workspace Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="editor" element={<BlueprintEditor />} />
              <Route path="compare" element={<Compare />} />
              <Route path="settings" element={<Settings />} />
              <Route
                path="*"
                element={
                  <div className="text-center py-20 text-muted-foreground font-sans">
                    Page Not Found
                  </div>
                }
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
