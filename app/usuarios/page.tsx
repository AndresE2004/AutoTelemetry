"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getApiBaseUrl, fetchMe, fetchUsers, createUser, deleteUser, patchUser, type ApiUser } from "@/lib/api"
import { ROLE_LABELS, type Role } from "@/lib/rbac"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"

export default function UsuariosPage() {
  const router = useRouter()
  const baseUrl = useMemo(() => getApiBaseUrl(), [])

  const [me, setMe] = useState<ApiUser | null>(null)
  const [users, setUsers] = useState<ApiUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newEmail, setNewEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [newFullName, setNewFullName] = useState("")
  const [newRole, setNewRole] = useState<Role>("viewer")

  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<ApiUser | null>(null)
  const [editEmail, setEditEmail] = useState("")
  const [editFullName, setEditFullName] = useState("")
  const [editRole, setEditRole] = useState<Role>("viewer")
  const [editActive, setEditActive] = useState(true)
  const [editPassword, setEditPassword] = useState("")

  async function load() {
    if (!baseUrl) {
      setError("Falta NEXT_PUBLIC_API_URL (ej.: http://localhost:8000).")
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const who = await fetchMe(baseUrl)
      if ((who.role || "").toLowerCase() !== "admin") {
        setMe(who)
        setUsers([])
        setError("No autorizado: esta vista requiere rol admin.")
        setLoading(false)
        return
      }
      setMe(who)
      const list = await fetchUsers(baseUrl)
      setUsers(list)
    } catch (e) {
      // Si no está autenticado, redirige a login.
      router.replace(`/login?next=${encodeURIComponent("/usuarios")}`)
      return
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openEdit = (u: ApiUser) => {
    setEditing(u)
    setEditEmail(u.email)
    setEditFullName(u.full_name ?? "")
    setEditRole(((u.role ?? "viewer") as Role) || "viewer")
    setEditActive(!!u.is_active)
    setEditPassword("")
    setEditOpen(true)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
          <p className="text-sm text-muted-foreground">Gestión básica (CRUD) protegida con JWT/cookie.</p>
        </div>

        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Crear usuario</CardTitle>
            <CardDescription>Requiere sesión admin. Password mínimo 8 caracteres.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="newEmail">Email</Label>
              <Input id="newEmail" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="newPassword">Contraseña</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="newFullName">Nombre</Label>
              <Input id="newFullName" value={newFullName} onChange={(e) => setNewFullName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="newRole">Rol</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as Role)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground">Debes escoger un rol; no se escribe a mano.</div>
            </div>

            <div className="flex gap-2">
              <Button
                disabled={!baseUrl || !newEmail.trim() || !newPassword.trim() || loading}
                onClick={async () => {
                  if (!baseUrl) return
                  setLoading(true)
                  setError(null)
                  try {
                    await createUser(baseUrl, {
                      email: newEmail.trim(),
                      password: newPassword,
                      full_name: newFullName.trim() || undefined,
                      role: newRole,
                    })
                    setNewEmail("")
                    setNewPassword("")
                    setNewFullName("")
                    setNewRole("viewer")
                    await load()
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "No se pudo crear el usuario")
                  } finally {
                    setLoading(false)
                  }
                }}
              >
                Crear
              </Button>
              <Button variant="outline" onClick={() => load()} disabled={loading}>
                Refrescar
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Listado</CardTitle>
            <CardDescription>
              Sesión: <span className="font-mono">{me?.email ?? "—"}</span> · rol{" "}
              <span className="font-mono">{me?.role ?? "—"}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Activo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-mono">{u.email}</TableCell>
                    <TableCell>{u.full_name ?? "—"}</TableCell>
                    <TableCell className="font-mono">{u.role ?? "—"}</TableCell>
                    <TableCell>{u.is_active ? "Sí" : "No"}</TableCell>
                    <TableCell className="text-right">
                      <Dialog open={editOpen && editing?.id === u.id} onOpenChange={(o) => (o ? openEdit(u) : setEditOpen(false))}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mr-2"
                            disabled={!baseUrl || loading}
                            onClick={() => openEdit(u)}
                          >
                            Editar
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Editar usuario</DialogTitle>
                            <DialogDescription>
                              Cambios se guardan en la base de datos. Si cambias contraseña, debe tener mínimo 8 caracteres.
                            </DialogDescription>
                          </DialogHeader>

                          <div className="grid gap-3">
                            <div className="grid gap-2">
                              <Label htmlFor="editEmail">Email</Label>
                              <Input id="editEmail" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="editFullName">Nombre</Label>
                              <Input id="editFullName" value={editFullName} onChange={(e) => setEditFullName(e.target.value)} />
                            </div>
                            <div className="grid gap-2">
                              <Label>Rol</Label>
                              <Select value={editRole} onValueChange={(v) => setEditRole(v as Role)}>
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                      {label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-center justify-between rounded-md border p-3">
                              <div className="grid gap-0.5">
                                <div className="text-sm font-medium">Activo</div>
                                <div className="text-xs text-muted-foreground">Desactiva para bloquear acceso.</div>
                              </div>
                              <Switch checked={editActive} onCheckedChange={setEditActive} />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="editPassword">Nueva contraseña (opcional)</Label>
                              <Input
                                id="editPassword"
                                type="password"
                                value={editPassword}
                                onChange={(e) => setEditPassword(e.target.value)}
                                placeholder="Deja en blanco para no cambiar"
                              />
                            </div>
                          </div>

                          <DialogFooter>
                            <Button
                              variant="outline"
                              type="button"
                              onClick={() => setEditOpen(false)}
                            >
                              Cancelar
                            </Button>
                            <Button
                              type="button"
                              disabled={!baseUrl || loading}
                              onClick={async () => {
                                if (!baseUrl || !editing) return
                                setLoading(true)
                                setError(null)
                                try {
                                  await patchUser(baseUrl, editing.id, {
                                    email: editEmail.trim() || null,
                                    full_name: editFullName.trim() || null,
                                    role: editRole,
                                    is_active: editActive,
                                    password: editPassword.trim() ? editPassword : null,
                                  })
                                  setEditOpen(false)
                                  await load()
                                } catch (e) {
                                  setError(e instanceof Error ? e.message : "No se pudo actualizar")
                                } finally {
                                  setLoading(false)
                                }
                              }}
                            >
                              Guardar
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={!baseUrl || loading || u.email === "admin@telema.example"}
                        onClick={async () => {
                          if (!baseUrl) return
                          if (!confirm(`Eliminar usuario ${u.email}?`)) return
                          setLoading(true)
                          setError(null)
                          try {
                            await deleteUser(baseUrl, u.id)
                            await load()
                          } catch (e) {
                            setError(e instanceof Error ? e.message : "No se pudo eliminar")
                          } finally {
                            setLoading(false)
                          }
                        }}
                      >
                        Eliminar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      Sin usuarios o sin permisos.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

