import { Link, createFileRoute } from "@tanstack/react-router"
import { buttonVariants } from "@/components/ui/button"
import z from "zod"
import { zodValidator } from "@tanstack/zod-adapter"

const loginSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute("/login")({
  component: RouteComponent,
  validateSearch: zodValidator(loginSchema),
})

const api = import.meta.env.VITE_API_BASE

function RouteComponent() {
  const { redirect } = Route.useSearch()
  return (
    <div className="flex w-full justify-center px-4 py-8 sm:py-12">
      <div className="flex w-full max-w-xl flex-col gap-6">
        <div className="space-y-2">
          <Link
            to="/"
            className={buttonVariants({ variant: "ghost", className: "-ml-4" })}
          >
            Home
          </Link>
          <h1 className="text-3xl font-semibold tracking-normal">Login</h1>
          <p className="text-sm text-muted-foreground">
            Choose a provider to continue to RiftBench.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <a
            href={`${api}/auth/login/github${redirect ? `?returnUrl=${encodeURIComponent(redirect)}` : ""}`}
            className={buttonVariants()}
          >
            Login with GitHub
          </a>
          <a
            href={`${api}/auth/login/discord${redirect ? `?returnUrl=${encodeURIComponent(redirect)}` : ""}`}
            className={buttonVariants({ variant: "outline" })}
          >
            Login with Discord
          </a>
        </div>
      </div>
    </div>
  )
}
