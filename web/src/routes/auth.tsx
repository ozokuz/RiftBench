import { authenticateFn } from "@/server/auth"
import { createFileRoute } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import z from "zod"
import { zodValidator } from "@tanstack/zod-adapter"
import { client } from "@/client/client.gen"
import { useAuth } from "@/lib/auth"
import { useQuery } from "@tanstack/react-query"
import { useEffect } from "react"

const authSchema = z.object({
  auth_code: z.string(),
  redirect_url: z.string(),
})

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: RouteComponent,
  validateSearch: zodValidator(authSchema),
})

function RouteComponent() {
  const { auth_code, redirect_url } = Route.useSearch()
  const navigate = Route.useNavigate()
  const authenticate = useServerFn(authenticateFn)
  const { refetch } = useAuth()
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["auth", auth_code],
    queryFn: () => authenticate({ data: { code: auth_code } }),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (isLoading) {
      return
    }

    if (isError) {
      console.error("Authentication failed:", error)
      navigate({ to: "/login" })
      return
    }

    if (!data) {
      return
    }

    client.setConfig({
      baseUrl: import.meta.env.VITE_API_BASE,
      headers: { Authorization: `Bearer ${data.accessToken}` },
    })
    refetch()
    navigate({ to: redirect_url } as any)
  }, [data, error, isError, isLoading, navigate, redirect_url, refetch])

  if (isLoading) {
    return <div>Authenticating...</div>
  }

  if (isError) {
    return <div>Authentication failed. Redirecting to login...</div>
  }

  return <div>Redirecting...</div>
}
