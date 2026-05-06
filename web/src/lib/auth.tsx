import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from "react"
import { useServerFn } from "@tanstack/react-start"
import { getCurrentUserFn } from "../server/auth"
import { useQuery } from "@tanstack/react-query"
import { client } from "@/client/client.gen"

type User = {
  accessToken: string
  userId: string
  email: string
  username: string
}

type AuthContextType = {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  refetch: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const getCurrentUser = useServerFn(getCurrentUserFn)
  const {
    data: user,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["me"],
    queryFn: () => getCurrentUser(),
  })

  useEffect(() => {
    if (!user) {
      return
    }

    client.setConfig({
      headers: {
        Authorization: `Bearer ${user.accessToken}`,
      },
    })
  }, [user])

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isAuthenticated: !!user,
        isLoading,
        refetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
