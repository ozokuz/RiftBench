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

export function setClientAccessToken(accessToken: string) {
  client.setConfig({
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const getCurrentUser = useServerFn(getCurrentUserFn)
  const {
    data: user,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const currentUser = await getCurrentUser()
      if (currentUser) {
        setClientAccessToken(currentUser.accessToken)
      }

      return currentUser
    },
  })

  useEffect(() => {
    if (!user) {
      return
    }

    setClientAccessToken(user.accessToken)
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
