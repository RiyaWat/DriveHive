import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// Silence expected 401s on the auth-check endpoint. Any component calling
// /auth/me wants to know "am I logged in?" — not-logged-in is not an error.
api.interceptors.response.use(
  (r) => r,
  (error) => {
    const url = error?.config?.url || "";
    const status = error?.response?.status;
    if (status === 401 && url.includes("/auth/me")) {
      // Resolve as "unauthenticated" payload instead of rejecting.
      return Promise.resolve({ data: null, status: 401, unauth: true });
    }
    return Promise.reject(error);
  }
);

// Convert FastAPI error objects to readable strings
export function formatApiErrorDetail(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export function fileUrl(path) {
  if (!path) return null;
  return `${API_BASE}/files/${path}`;
}
