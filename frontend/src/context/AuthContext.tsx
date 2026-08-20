import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../services/api";

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  user_metadata?: {
    full_name?: string;
  };
}

export interface SessionInfo {
  access_token: string;
}

interface AuthContextType {
  user: UserProfile | null;
  session: SessionInfo | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  sendSignUpOTP: (email: string) => Promise<{ error: Error | null }>;
  verifySignUpOTPAndRegister: (email: string, otp: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
}

const TOKEN_KEY = "promptvault_token";
const USER_KEY = "promptvault_user";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Helper to persist auth session in state & localStorage
  const setAuthSession = (jwtToken: string, userObj: UserProfile) => {
    localStorage.setItem(TOKEN_KEY, jwtToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userObj));
    setToken(jwtToken);
    setUser({
      ...userObj,
      user_metadata: { full_name: userObj.name || userObj.user_metadata?.full_name || userObj.email.split("@")[0] }
    });
    setSession({ access_token: jwtToken });
    setLoading(false);
  };

  // Helper to clear auth session cleanly
  const clearAuthSession = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem("promptvault_dev_session");
    
    // Also clear sessionStorage just in case it was somehow used
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem("promptvault_welcome_shown");
    
    // Clear cookies if they were used for auth
    document.cookie = "promptvault_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    
    try {
      document.documentElement.setAttribute("data-pv-extension-connected", "false");
      (window as any).__pvExtensionConnected = false;
      window.dispatchEvent(new CustomEvent("pv-extension-status", {
        detail: { installed: true, connected: false }
      }));
    } catch (e) {}

    setToken(null);
    setUser(null);
    setSession(null);
    setLoading(false);
  };

  useEffect(() => {
    // 1. Initial hydration from localStorage on app load / page refresh
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);

    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setToken(storedToken);
        setUser({
          ...parsedUser,
          user_metadata: { full_name: parsedUser.name || parsedUser.user_metadata?.full_name || parsedUser.email.split("@")[0] }
        });
        setSession({ access_token: storedToken });
        setLoading(false);

        // Verify token in background with /api/me
        api.get("/me").then((res) => {
          if (res.data) {
            const updatedUser = {
              id: res.data.id,
              email: res.data.email,
              name: res.data.name,
              user_metadata: { full_name: res.data.name }
            };
            localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
            setUser(updatedUser);
          }
        }).catch((err) => {
          if (err.response && err.response.status === 401) {
            console.warn("Saved token is no longer valid. Clearing session.");
            clearAuthSession();
          }
        });
        return;
      } catch (e) {
        clearAuthSession();
        return;
      }
    }

    setLoading(false);
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    if (!email || !password) {
      return { error: new Error("Email and password are required.") };
    }

    try {
      const response = await api.post("/login", { email, password });
      const data = response.data;

      if (data.access_token && data.user) {
        setAuthSession(data.access_token, data.user);
        return { error: null };
      }
      return { error: new Error("Invalid response format from server.") };
    } catch (err: any) {
      const message = err.response?.data?.detail || err.message || "Login failed. Please check your credentials.";
      return { error: new Error(message) };
    }
  };

  const sendSignUpOTP = async (email: string) => {
    if (!email) return { error: new Error("Email is required.") };

    try {
      // First, quickly check with backend if email is already taken
      try {
        await api.get(`/auth/check-email?email=${encodeURIComponent(email)}`);
      } catch (err: any) {
        if (err.response?.status === 409) {
          return { error: new Error("This email is already registered. Please sign in or use a different email.") };
        }
      }

      const response = await api.post("/auth/send-otp", { email });
      return { error: null };
    } catch (err: any) {
      return { error: new Error(err.response?.data?.detail || err.message || "Failed to send OTP.") };
    }
  };

  const verifySignUpOTPAndRegister = async (email: string, otp: string, password: string, fullName: string) => {
    if (!email || !otp || !password || !fullName) {
      return { error: new Error("All fields are required.") };
    }

    try {
      const response = await api.post("/auth/verify-otp", { 
        email, 
        otp_code: otp,
        password,
        name: fullName
      });
      const data = response.data;

      if (data.access_token && data.user) {
        setAuthSession(data.access_token, data.user);
        return { error: null };
      }
      return { error: new Error("Registration failed.") };
    } catch (err: any) {
      const detail = err.response?.data?.detail || err.message || "";
      let message = detail;
      if (err.response?.status === 409 || detail.toLowerCase().includes("already registered")) {
        message = "This email is already registered. Please sign in or use a different email.";
      } else if (!message) {
        message = "Incorrect verification code or registration failed.";
      }
      return { error: new Error(message) };
    }
  };

  const signInWithGoogle = async () => {
    try {
      // Mock Google sign-in fallback for local testing
      const mockEmail = "user@promptvault.io";
      const mockName = "Google User";
      const response = await api.post("/auth/verify-otp", { email: mockEmail, otp: "123456" });
      if (response.data?.access_token) {
        setAuthSession(response.data.access_token, response.data.user || { id: "google_1", email: mockEmail, name: mockName });
        return { error: null };
      }
      return { error: null };
    } catch (err: any) {
      return { error: new Error("Google Sign-In failed.") };
    }
  };

  const signOut = async () => {
    try {
      await api.post("/logout");
    } catch (e) {
      // ignore network errors on logout
    }
    clearAuthSession();
    return { error: null };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        token,
        loading,
        isAuthenticated: Boolean(user && token),
        signInWithEmail,
        sendSignUpOTP,
        verifySignUpOTPAndRegister,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
