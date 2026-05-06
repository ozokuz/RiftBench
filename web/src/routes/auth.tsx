import { authenticateFn } from "@/server/auth"
import { createFileRoute } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import z from "zod"
import { zodValidator } from "@tanstack/zod-adapter"
import { client } from "@/client/client.gen"

const authSchema = z.object({
  auth_code: z.string(),
  redirect_url: z.string(),
})

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: RouteComponent,
  validateSearch: zodValidator(authSchema),
})

export var accessToken: string | null = null

function RouteComponent() {
  const { auth_code, redirect_url } = Route.useSearch()
  const navigate = Route.useNavigate()
  const authenticate = useServerFn(authenticateFn)

  authenticate({ data: { code: auth_code, redirectUrl: redirect_url } }).then(
    (tokens) => {
      if (tokens.error) {
        console.error("Authentication failed:", tokens.error)
        navigate({ to: "/login" })
        return
      }

      client.setConfig({
        baseUrl: process.env.VITE_API_BASE,
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      })

      navigate({ to: redirect_url } as any)
    }
  )

  return <div>Authenticating...</div>
}
