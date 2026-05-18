import {
  HeadContent,
  Link,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"
import { User } from "lucide-react"
import type { QueryClient } from "@tanstack/react-query"

import appCss from "../styles.css?url"
import { AuthProvider, useAuth } from "@/lib/auth"
import { client } from "@/client/client.gen"
import { Button } from "@/components/ui/button"

client.setConfig({
  baseUrl: import.meta.env.VITE_API_BASE,
})

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      meta: [
        {
          charSet: "utf-8",
        },
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        },
        {
          title: "TanStack Start Starter",
        },
      ],
      links: [
        {
          rel: "stylesheet",
          href: appCss,
        },
      ],
    }),
    notFoundComponent: () => (
      <div className="container mx-auto p-4 pt-16">
        <h1>404</h1>
        <p>The requested page could not be found.</p>
      </div>
    ),
    shellComponent: RootDocument,
  }
)

function UserArea() {
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return (
      <div>
        <Button>Login</Button>
      </div>
    )
  }

  return (
    <div>
      <Button variant="outline">
        <User className="mr-2 size-4" />
        {user?.username}
      </Button>
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <nav className="flex h-12 bg-[#333333] p-2 px-4 text-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link className="text-lg font-semibold" to="/">
              RiftBench
            </Link>
            <Link className="text-sm" to="/browse">
              Browse
            </Link>
            <Link className="text-sm" to="/decks">
              My Decks
            </Link>
          </div>
          <UserArea />
        </div>
      </nav>
      <main className="mx-auto flex w-full max-w-7xl grow flex-col">
        {children}
      </main>
      <footer className="bg-[#333333] text-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between p-4 md:flex-row">
          <div className="flex items-center justify-center gap-2 text-center text-sm text-muted-foreground md:flex-col md:gap-0">
            <span className="text-lg font-semibold">RiftBench</span>
            <span className="text-sm">
              &copy; Ozoku {new Date().getFullYear()}
            </span>
          </div>
          <div className="text-center text-sm text-muted-foreground">
            <p className="flex-col md:flex">
              <span>
                RiftBench was created under Riot Games' "Legal Jibber Jabber"
                policy using assets
              </span>
              <span>
                owned by Riot Games. Riot Games does not endorse or sponsor this
                project.
              </span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="dark">
        <AuthProvider>
          <Shell>{children}</Shell>
          <TanStackDevtools
            config={{
              position: "bottom-right",
            }}
            plugins={[
              {
                name: "Tanstack Router",
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  )
}
