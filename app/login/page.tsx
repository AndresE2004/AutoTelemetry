"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { persistRefreshToken } from "@/lib/auth-session"
import { getApiBaseUrl, fetchMe, login } from "@/lib/api"
import Link from "next/link"

export default function LoginPage() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get("next") || "/"

  const baseUrl = useMemo(() => getApiBaseUrl(), [])
  const [email, setEmail] = useState("admin@telema.example")
  const [password, setPassword] = useState("Admin12345!")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!baseUrl) {
      setReady(true)
      return
    }
    fetchMe(baseUrl)
      .then(() => router.replace(next))
      .catch(() => setReady(true))
  }, [baseUrl, router, next])

  const canSubmit = !!baseUrl && email.trim() && password.trim() && !loading

  return (
    <DashboardLayout requireAuth={false}>
      <div className="mx-auto grid w-full max-w-md gap-6 pt-10">
        <Card>
          <CardHeader>
            <CardTitle>Iniciar sesión</CardTitle>
            <CardDescription>Accede con tus credenciales.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {!baseUrl ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                Falta <span className="font-mono">NEXT_PUBLIC_API_URL</span> (ej.:{" "}
                <span className="font-mono">http://localhost:8000</span>).
              </div>
            ) : null}
            {error ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                {error}
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@telema.example"
                autoComplete="username"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <Button
              disabled={!canSubmit || !ready}
              onClick={async () => {
                if (!baseUrl) return
                setLoading(true)
                setError(null)
                try {
                  const pair = await login(baseUrl, { email, password })
                  persistRefreshToken(pair.refresh_token)
                  await fetchMe(baseUrl)
                  router.replace(next)
                } catch (e) {
                  setError(e instanceof Error ? e.message : "No se pudo iniciar sesión")
                } finally {
                  setLoading(false)
                }
              }}
            >
              {loading ? "Entrando…" : "Entrar"}
            </Button>

            <div className="text-xs text-muted-foreground">
              ¿Primera vez?{" "}
              <Link className="underline underline-offset-4 hover:text-foreground" href="/setup">
                Crear usuario inicial
              </Link>
            </div>

            <div className="text-xs text-muted-foreground">Si tienes problemas para entrar, revisa tu sesión.</div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

