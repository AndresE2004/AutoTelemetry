"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { persistRefreshToken } from "@/lib/auth-session"
import { createUser, getApiBaseUrl, login } from "@/lib/api"

export default function SetupPage() {
  const router = useRouter()
  const baseUrl = useMemo(() => getApiBaseUrl(), [])

  const [email, setEmail] = useState("admin@telema.example")
  const [password, setPassword] = useState("Admin12345!")
  const [fullName, setFullName] = useState("Admin Inicial")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = !!baseUrl && email.trim() && password.trim().length >= 8 && !loading

  return (
    <DashboardLayout requireAuth={false}>
      <div className="mx-auto grid w-full max-w-md gap-6 pt-10">
        <Card>
          <CardHeader>
            <CardTitle>Crear usuario inicial</CardTitle>
            <CardDescription>
              Esto solo funciona si aún no existe ningún usuario en la BD. Crea un admin y luego inicia sesión.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {error ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</div>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>

            <Button
              disabled={!canSubmit}
              onClick={async () => {
                if (!baseUrl) return
                setLoading(true)
                setError(null)
                try {
                  await createUser(baseUrl, {
                    email: email.trim(),
                    password,
                    full_name: fullName.trim() || undefined,
                    role: "admin",
                    is_active: true,
                  })
                  const pair = await login(baseUrl, { email: email.trim(), password })
                  persistRefreshToken(pair.refresh_token)
                  router.replace("/")
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "No se pudo crear. Si ya hay usuarios, crea desde /usuarios con un admin existente o corre seed_demo.py.",
                  )
                } finally {
                  setLoading(false)
                }
              }}
            >
              {loading ? "Creando…" : "Crear admin y entrar"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

