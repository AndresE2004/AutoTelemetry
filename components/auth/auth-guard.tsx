"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  ACCESS_REFRESH_INTERVAL_MS,
  clearStoredRefreshToken,
  persistRefreshToken,
  readRefreshToken,
} from "@/lib/auth-session"
import { fetchMe, getApiBaseUrl, refreshSession, type ApiUser } from "@/lib/api"
import { canAccessPathname } from "@/lib/route-features"
import { Spinner } from "@/components/ui/spinner"
import Link from "next/link"
import { AuthUserProvider } from "@/components/auth/auth-context"

type AuthGuardProps = {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const baseUrl = useMemo(() => getApiBaseUrl(), [])

  const [state, setState] = useState<
    | { status: "checking" }
    | { status: "authed"; user: ApiUser }
    | { status: "unauthed" }
    | { status: "misconfigured"; message: string }
  >({ status: "checking" })

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (!baseUrl) {
        if (!cancelled) {
          setState({
            status: "misconfigured",
            message:
              "Falta configurar la URL de la API (NEXT_PUBLIC_API_URL).",
          })
        }
        return
      }

      try {
        const user = await fetchMe(baseUrl)
        if (!cancelled) setState({ status: "authed", user })
      } catch {
        if (!cancelled) setState({ status: "unauthed" })
        const next = encodeURIComponent(pathname || "/")
        router.replace(`/login?next=${next}`)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [baseUrl, router, pathname])

  useEffect(() => {
    if (state.status !== "authed" || !baseUrl) return

    const tick = async () => {
      const rt = readRefreshToken()
      if (!rt) return
      try {
        const pair = await refreshSession(baseUrl, rt)
        persistRefreshToken(pair.refresh_token)
      } catch {
        clearStoredRefreshToken()
        router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`)
      }
    }

    const id = window.setInterval(tick, ACCESS_REFRESH_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [state.status, baseUrl, router, pathname])

  if (state.status === "authed") {
    if (!canAccessPathname(state.user.role, pathname)) {
      return (
        <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-lg font-semibold text-foreground">Sin permiso para esta sección</p>
          <p className="text-sm text-muted-foreground">
            Tu rol (<span className="font-mono">{state.user.role ?? "—"}</span>) no incluye esta pantalla. El menú ya
            filtra rutas; si llegaste por URL directa, vuelve al inicio.
          </p>
          <Link href="/" className="text-sm font-medium text-[var(--tm-info)] underline underline-offset-4">
            Ir al resumen
          </Link>
        </div>
      )
    }
    return <AuthUserProvider user={state.user}>{children}</AuthUserProvider>
  }

  if (state.status === "misconfigured") {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center justify-center p-6">
        <div className="w-full rounded-xl border bg-card p-6 text-sm">
          {state.message}
        </div>
      </div>
    )
  }

  // checking / unauthed: mostramos loader breve para evitar parpadeo.
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
      <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
        <Spinner className="h-4 w-4" />
        Verificando sesión…
      </div>
    </div>
  )
}

