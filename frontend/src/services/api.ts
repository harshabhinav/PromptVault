import axios from "axios";

// Base API instance targeting the FastAPI server
const api = axios.create({
  baseURL: "http://localhost:8000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach JWT access token to every outgoing request
api.interceptors.request.use(async (config) => {
  try {
    const localToken = localStorage.getItem("promptvault_token");
    if (localToken) {
      config.headers.Authorization = `Bearer ${localToken}`;
      return config;
    }
  } catch (err) {
    // Continue without token if session unavailable
  }
  return config;
});

// Response interceptor to catch 401 Unauthorized responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn("Unauthorized API call. Clearing token and redirecting to login...");
      localStorage.removeItem("promptvault_token");
      localStorage.removeItem("promptvault_dev_session");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export interface Blueprint {
  id: number;
  name: string;
  description: string | null;
  forked_from: number | null;
  is_pinned: boolean;
  pinned_at: string | null;
  created_at: string;
  version_count: number;
  test_case_count: number;
  average_ai_score: number | null;
  last_updated: string | null;
}

export interface Version {
  id: number;
  blueprint_id: number;
  version_number: number | null;
  system_prompt: string;
  user_prompt: string | null;
  parameters_json: string | null;
  created_at: string;
}

export interface TestCase {
  id: number;
  blueprint_id: number;
  name: string;
  input_text: string;
  expected_behavior: string | null;
  last_status: string; // "pass", "fail", "changed", "unevaluated"
  last_latency: number;
  last_run_at: string | null;
}

export interface TestRun {
  test_case_id: number;
  test_case_name: string;
  expected_behavior: string | null;
  input_text: string;
  output_text: string;
  latency: number;
  token_usage: number;
  estimated_cost: number;
}

export interface CompareMetrics {
  averageLatencyA: number;
  averageLatencyB: number;
  totalTokensA: number;
  totalTokensB: number;
  estimatedCostA: number;
  estimatedCostB: number;
}

export interface AISummaryDetails {
  behavior_changes: string;
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
}

export interface RegressionReportItem {
  test_case_id: number;
  test_case_name: string;
  status: "improved" | "no_change" | "worse";
  explanation: string;
}

export interface VersionScores {
  helpfulness: number;
  accuracy: number;
  consistency: number;
  safety: number;
  conciseness: number;
  professional_tone: number;
}

export interface ScorecardData {
  version_a: VersionScores;
  version_b: VersionScores;
}

export interface CompareResponse {
  summary: AISummaryDetails;
  regression_report: RegressionReportItem[];
  scorecard: ScorecardData;
  test_case_comments: Record<string, string>;
  resultsA: TestRun[];
  resultsB: TestRun[];
  metrics: CompareMetrics;
}

export const blueprintApi = {
  list: async (): Promise<Blueprint[]> => {
    const res = await api.get("/blueprints/dashboard");
    return res.data;
  },
  get: async (id: number): Promise<Blueprint> => {
    const res = await api.get(`/blueprints/${id}`);
    return res.data;
  },
  create: async (data: { name: string; description?: string; forked_from?: number }): Promise<Blueprint> => {
    const res = await api.post("/blueprints", data);
    return res.data;
  },
  update: async (id: number, data: { name: string; description?: string }): Promise<Blueprint> => {
    const res = await api.put(`/blueprints/${id}`, data);
    return res.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/blueprints/${id}`);
  },
  fork: async (id: number): Promise<Blueprint> => {
    const res = await api.post(`/blueprints/${id}/fork`);
    return res.data;
  },
  togglePin: async (id: number): Promise<Blueprint> => {
    const res = await api.patch(`/blueprints/${id}/pin`);
    return res.data;
  },
};

export const versionApi = {
  list: async (blueprintId: number): Promise<Version[]> => {
    const res = await api.get(`/blueprints/${blueprintId}/versions`);
    return res.data;
  },
  get: async (id: number): Promise<Version> => {
    const res = await api.get(`/versions/${id}`);
    return res.data;
  },
  create: async (data: {
    blueprint_id: number;
    system_prompt: string;
    user_prompt?: string;
    parameters_json?: string;
  }): Promise<Version> => {
    const res = await api.post("/versions", data);
    return res.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/versions/${id}`);
  },
};

export interface SingleTestRunResponse {
  output_text: string;
  latency: number;
  token_usage: number;
  estimated_cost: number;
  timestamp: string;
}

export const testCaseApi = {
  list: async (blueprintId: number): Promise<TestCase[]> => {
    const res = await api.get(`/blueprints/${blueprintId}/test-cases`);
    return res.data;
  },
  create: async (blueprintId: number, data: { name: string; input_text: string; expected_behavior?: string }): Promise<TestCase> => {
    const res = await api.post(`/blueprints/${blueprintId}/test-cases`, data);
    return res.data;
  },
  update: async (id: number, data: { name: string; input_text: string; expected_behavior?: string }): Promise<TestCase> => {
    const res = await api.put(`/test-cases/${id}`, data);
    return res.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/test-cases/${id}`);
  },
  duplicate: async (id: number): Promise<TestCase> => {
    const res = await api.post(`/test-cases/${id}/duplicate`);
    return res.data;
  },
  runSingle: async (data: {
    test_case_id?: number;
    system_prompt: string;
    user_prompt: string;
    input_text: string;
    expected_behavior?: string;
  }): Promise<SingleTestRunResponse> => {
    const res = await api.post("/test-cases/run-single", data);
    return res.data;
  }
};

export interface ComparisonHistoryItem {
  id: number;
  blueprint_id: number;
  blueprint_name: string;
  version_a_id: number;
  version_b_id: number;
  version_a_label: string;
  version_b_label: string;
  comparison_type: string;
  status: string;
  created_at: string;
}

export const compareApi = {
  run: async (data: { versionA: number; versionB: number }): Promise<CompareResponse> => {
    const res = await api.post("/compare", data);
    return res.data;
  },
  logGitDiff: async (data: { versionA: number; versionB: number; blueprintId: number }): Promise<{ message: string; id: number }> => {
    const res = await api.post("/compare/git-diff", data);
    return res.data;
  },
  getHistory: async (): Promise<ComparisonHistoryItem[]> => {
    const res = await api.get("/compare/history");
    return res.data;
  },
  clearHistory: async (): Promise<void> => {
    await api.delete("/compare/history");
  }
};

export interface DashboardStats {
  total_blueprints: number;
  total_versions: number;
  total_comparisons: number;
  total_test_cases: number;
  regression_warnings: number;
  average_ai_score: number | null;
}

export interface ActivityLog {
  id: number;
  event_type: string;
  blueprint_id: number | null;
  blueprint_name: string;
  version_id?: number | null;
  version_label?: string;
  description: string;
  created_at: string;
}

export interface ActivityResponse {
  items: ActivityLog[];
  total: number;
  has_more: boolean;
  limit: number;
  offset: number;
}

export interface RegressionDetail {
  id: number;
  blueprint_id: number | null;
  blueprint_name: string;
  compared_versions: string;
  test_case_name: string;
  explanation: string;
  created_at: string;
}

export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    const res = await api.get("/dashboard/stats");
    return res.data;
  },
  getActivities: async (): Promise<ActivityLog[]> => {
    const res = await api.get("/dashboard/activities");
    if (res.data && Array.isArray(res.data.items)) {
      return res.data.items;
    }
    if (Array.isArray(res.data)) {
      return res.data;
    }
    return [];
  },
  getRegressions: async (): Promise<RegressionDetail[]> => {
    const res = await api.get("/dashboard/regressions");
    return res.data;
  },
  clearActivities: async (): Promise<void> => {
    await api.delete("/dashboard/activities");
  },
  clearRegression: async (id: number): Promise<void> => {
    await api.delete(`/dashboard/regressions/${id}`);
  },
  clearAllRegressions: async (): Promise<void> => {
    await api.delete("/dashboard/regressions/all");
  }
};

export interface PlaygroundMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  latency?: number;
  tokens?: number;
}

export const playgroundApi = {
  chat: async (data: {
    blueprint_id?: number;
    version_id?: number;
    is_draft?: boolean;
    draft_system_prompt?: string;
    draft_user_prompt?: string;
    messages: { role: string; content: string }[];
    model?: string;
    temperature?: number;
    max_tokens?: number;
  }): Promise<{ role: "assistant"; content: string; latency?: number; tokens?: number; cost?: number; timestamp?: string }> => {
    const res = await api.post("/playground/chat", data);
    return res.data;
  },
  save: async (data: {
    blueprint_id: number;
    version_id?: number;
    version_label?: string;
    messages: any[];
    model?: string;
    temperature?: number;
    max_tokens?: number;
    conversation_id?: string;
  }): Promise<{ message: string; session_id: number; conversation_id: string }> => {
    const res = await api.post("/playground/save", data);
    return res.data;
  },
  getSessions: async (blueprintId: number): Promise<any[]> => {
    const res = await api.get(`/playground/sessions/${blueprintId}`);
    return res.data;
  }
};


export interface ApiKeyStatus {
  has_openai_key: boolean;
  has_anthropic_key: boolean;
  has_gemini_key: boolean;
  openai_masked: string | null;
  anthropic_masked: string | null;
  gemini_masked: string | null;
}

export const settingsApi = {
  getApiKeys: async (): Promise<ApiKeyStatus> => {
    const res = await api.get("/settings/api-keys");
    return res.data;
  },
  saveApiKeys: async (data: {
    openai_key?: string;
    anthropic_key?: string;
    gemini_key?: string;
  }): Promise<{ message: string }> => {
    const res = await api.post("/settings/api-keys", data);
    return res.data;
  },
  testConnection: async (provider: "anthropic" | "openai" | "gemini"): Promise<{ connected: boolean; message: string }> => {
    const res = await api.post("/settings/api-keys/test", { provider });
    return res.data;
  },
};

export default api;

