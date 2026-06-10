"use client"

import { createContext, useContext } from "react"
import type { ApiUser } from "@/lib/api"

const AuthUserContext = createContext<ApiUser | null>(null)

export function AuthUserProvider({
  user,
  children,
}: {
  user: ApiUser
  children: React.ReactNode
}) {
  return <AuthUserContext.Provider value={user}>{children}</AuthUserContext.Provider>
}

export function useAuthUser(): ApiUser | null {
  return useContext(AuthUserContext)
}
