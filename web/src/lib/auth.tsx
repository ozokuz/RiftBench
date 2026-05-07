import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from "react"
import { useServerFn } from "@tanstack/react-start"
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { client } from "@/client/client.gen"
import { getCurrentUserFn } from "@/server/auth"

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
  setUser: (user: User | null) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)
export const currentUserQueryKey = ["me"] as const

export function setClientAccessToken(accessToken: string) {
  if (typeof window === "undefined") {
    return
  }

  client.setConfig({
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
}

export function clearClientAccessToken() {
  if (typeof window === "undefined") {
    return
  }

  client.setConfig({
    headers: {
      Authorization: null,
    },
  })
}

export async function loadCurrentUser(getCurrentUser: () => Promise<User | null>) {
  const user = await getCurrentUser()
  if (user) {
    setClientAccessToken(user.accessToken)
  } else {
    clearClientAccessToken()
  }

  return user
}

export function currentUserQueryOptions(getCurrentUser: () => Promise<User | null>) {
  return {
    queryKey: currentUserQueryKey,
    queryFn: () => loadCurrentUser(getCurrentUser),
    staleTime: 60_000,
  }
}

export function setCurrentUserCache(queryClient: QueryClient, user: User | null) {
  queryClient.setQueryData(currentUserQueryKey, user)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const getCurrentUser = useServerFn(getCurrentUserFn)
  const queryClient = useQueryClient()
  const {
    data: user,
    isLoading,
    refetch,
  } = useQuery(currentUserQueryOptions(getCurrentUser))

  useEffect(() => {
    if (!user) {
      clearClientAccessToken()
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
        setUser: (nextUser) => setCurrentUserCache(queryClient, nextUser),
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
