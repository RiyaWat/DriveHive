import axios from "axios";

const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "");
export const API_BASE = `${BACKEND_URL}/api`;

// ---------------------------------------------------------------------------
// Auth token
// The backend also sets httpOnly cookies, but when the frontend (vercel.app) and
// the API (onrender.com) are different sites, iPhone Safari blocks those cookies.
// So we keep the access token the API returns and send it as a Bearer header.
// ---------------------------------------------------------------------------
const TOKEN_KEY = "drivehive_token";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode etc. — cookies still work where allowed */
  }
}

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// ---------------------------------------------------------------------------
// "Waking up the server" support
// The free Render instance sleeps after ~15 min idle; the first request then takes
// ~30-60 s. If a request is slow (or the network drops while it boots) we tell the
// UI so it can show a friendly banner instead of looking broken, and retry.
// ---------------------------------------------------------------------------
const SLOW_MS = 3500;
const MAX_RETRIES = 6;
let pending = 0;
let slowTimer = null;
let waking = false;

function emit(name) {
  window.dispatchEvent(new Event(name));
}
function setWaking(v) {
  if (waking === v) return;
  waking = v;
  emit(v ? "drivehive:waking" : "drivehive:awake");
}
export function isServerWaking() {
  return waking;
}

function startRequest() {
  pending += 1;
  if (!slowTimer) slowTimer = setTimeout(() => setWaking(true), SLOW_MS);
}
function endRequest(ok) {
  pending = Math.max(0, pending - 1);
  if (ok) setWaking(false);
  if (pending === 0 && slowTimer) {
    clearTimeout(slowTimer);
    slowTimer = null;
  }
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (!config.__tracked) {
    config.__tracked = true;
    startRequest();
  }
  return config;
});

function isWakeError(error) {
  if (!error || error.code === "ERR_CANCELED") return false;
  if (!error.response) return true; // network error / CORS-less 502 while the server boots
  return [502, 503, 504].includes(error.response.status);
}

api.interceptors.response.use(
  (r) => {
    endRequest(true);
    return r;
  },
  async (error) => {
    const config = error?.config;
    if (config && isWakeError(error) && (config.__retries || 0) < MAX_RETRIES) {
      config.__retries = (config.__retries || 0) + 1;
      setWaking(true);
      await new Promise((res) => setTimeout(res, 5000));
      return api.request(config); // still counted as the same pending request
    }
    endRequest(!!error?.response);

    // Silence expected 401s on the auth-check endpoint. Any component calling
    // /auth/me wants to know "am I logged in?" — not-logged-in is not an error.
    const url = config?.url || "";
    const status = error?.response?.status;
    if (status === 401 && url.includes("/auth/me")) {
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
  // Demo/seed images ship with the frontend (public/demo/*) or are absolute URLs.
  if (/^https?:\/\//i.test(path) || path.startsWith("/")) return path;
  return `${API_BASE}/files/${path}`;
}
