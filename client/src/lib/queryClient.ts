import { QueryClient, QueryFunction } from "@tanstack/react-query";

// CSRF token cache (in-memory, cleared on page refresh)
let csrfToken: string | null = null;

// Fetch CSRF token from server
async function fetchCsrfToken(): Promise<string> {
  try {
    const res = await fetch("/api/csrf-token", {
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to fetch CSRF token");
    const data = await res.json();
    return data.csrfToken;
  } catch (error) {
    console.error("Error fetching CSRF token:", error);
    throw error;
  }
}

// Get CSRF token (fetch if not cached)
async function getCsrfToken(): Promise<string> {
  if (!csrfToken) {
    csrfToken = await fetchCsrfToken();
  }
  return csrfToken;
}

// Clear CSRF token (called on logout)
export function clearCsrfToken() {
  csrfToken = null;
}

// Refresh CSRF token (called after login)
export async function refreshCsrfToken() {
  csrfToken = await fetchCsrfToken();
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  _retryCount: number = 0,
): Promise<Response> {
  // Prepare headers
  const headers: Record<string, string> = data ? { "Content-Type": "application/json" } : {};
  
  // Add CSRF token for state-changing requests
  if (method !== "GET" && method !== "HEAD") {
    try {
      const token = await getCsrfToken();
      headers["x-csrf-token"] = token;
    } catch (error) {
      console.error("Failed to get CSRF token for request:", error);
    }
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // Handle CSRF token errors - refresh token and retry once
  if (res.status === 403 && _retryCount === 0) {
    const errorData = await res.clone().json().catch(() => ({}));
    if (errorData.code === "CSRF_ERROR") {
      console.log("CSRF token expired, refreshing and retrying...");
      csrfToken = null; // Clear cached token
      await fetchCsrfToken().then(token => { csrfToken = token; }).catch(() => {});
      return apiRequest(method, url, data, 1); // Retry once
    }
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
