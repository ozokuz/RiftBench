import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react"
import { useServerFn } from "@tanstack/react-start"
import { getCurrentUserFn, refreshTokenFn } from "../server/auth"
import { useQuery } from "@tanstack/react-query"

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
  const attemptedRefresh = useRef(false)
  const {
    data: user,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["me"],
    queryFn: () => getCurrentUser(),
  })
  const refreshToken = useServerFn(refreshTokenFn)

  useEffect(() => {
    if (user || isLoading || attemptedRefresh.current) {
      return
    }

    attemptedRefresh.current = true
    refreshToken()
      .then(() => {
        refetch()
      })
      .catch((err) => {
        console.error("Failed to refresh token:", err)
      })
  }, [isLoading, refetch, refreshToken, user])

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
