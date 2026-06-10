/** Clave en localStorage para el refresh JWT (post-login). */
export const TELEMA_REFRESH_STORAGE_KEY = "telema_refresh_token"

/** Cadencia de llamadas a `POST /auth/refresh` (alinear con preferencia de producto / JWT_ACCESS_MINUTES). */
export const ACCESS_REFRESH_INTERVAL_MS = 7 * 60 * 1000

export function persistRefreshToken(token: string): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(TELEMA_REFRESH_STORAGE_KEY, token)
  } catch {
    /* quota / modo privado */
  }
}

export function readRefreshToken(): string | null {
  if (typeof window === "undefined") return null
  try {
    return localStorage.getItem(TELEMA_REFRESH_STORAGE_KEY)
  } catch {
    return null
  }
}

export function clearStoredRefreshToken(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(TELEMA_REFRESH_STORAGE_KEY)
  } catch {
    /* noop */
  }
}
