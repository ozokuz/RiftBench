import { useState, type ReactNode } from "react"
import { useServerFn } from "@tanstack/react-start"
import {
  HeadContent,
  Link,
  Scripts,
  createRootRouteWithContext,
  useNavigate,
} from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"
import { LayoutDashboard, LogOut, Menu } from "lucide-react"
import type { QueryClient } from "@tanstack/react-query"

import appCss from "../styles.css?url"
import { type User, AuthProvider, useAuth } from "@/lib/auth"
import { client } from "@/client/client.gen"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { logoutFn } from "@/server/auth"

client.setConfig({
  baseUrl: import.meta.env.VITE_API_BASE,
})

const navLinks = [
  { to: "/", label: "RiftBench", brand: true },
  { to: "/browse", label: "Browse" },
  { to: "/decks", label: "My Decks" },
] as const

const brandLink = navLinks[0]
const primaryNavLinks = navLinks.slice(1)

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

function getUserInitial(username: string) {
  return username.trim().charAt(0).toUpperCase() || "U"
}

function DesktopNavLinks() {
  return (
    <div className="hidden items-center gap-4 md:flex">
      {primaryNavLinks.map((link) => (
        <Link
          key={link.to}
          className="text-sm text-white/80 transition-colors hover:text-white"
          to={link.to}
        >
          {link.label}
        </Link>
      ))}
    </div>
  )
}

function LoginLink({
  className,
  onNavigate,
}: {
  className?: string
  onNavigate?: () => void
}) {
  return (
    <Link
      className={cn(buttonVariants({ size: "sm" }), className)}
      onClick={onNavigate}
      to="/login"
    >
      Login
    </Link>
  )
}

function UserMenu({
  user,
  onLogout,
}: {
  user: User
  onLogout: () => Promise<void>
}) {
  const navigate = useNavigate()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
        )}
      >
        <Avatar size="sm">
          <AvatarFallback>{getUserInitial(user.username)}</AvatarFallback>
        </Avatar>
        <span className="hidden sm:inline">{user.username}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <div className="px-1.5 py-1">
          <div className="font-medium text-foreground">{user.username}</div>
          <div className="text-xs text-muted-foreground">{user.email}</div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate({ to: "/decks" })}>
          <LayoutDashboard />
          My Decks
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onLogout} variant="destructive">
          <LogOut />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MobileNavDrawer({
  isAuthenticated,
  user,
  onLogout,
}: {
  isAuthenticated: boolean
  user: User | null
  onLogout: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)

  const closeDrawer = () => {
    setOpen(false)
  }

  const handleLogout = async () => {
    closeDrawer()
    await onLogout()
  }

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "hover:bg-white/10 hover:text-white md:hidden"
        )}
      >
        <Menu />
        <span className="sr-only">Open navigation menu</span>
      </SheetTrigger>
      <SheetContent className="w-[18rem] gap-0 p-0" side="right">
        <SheetHeader className="border-b border-border">
          <SheetTitle>{brandLink.label}</SheetTitle>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-6 p-4">
          <div className="flex flex-col gap-2">
            {primaryNavLinks.map((link) => (
              <Link
                key={link.to}
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "justify-start"
                )}
                onClick={closeDrawer}
                to={link.to}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <Separator />

          {isAuthenticated && user ? (
            <div className="mt-auto flex flex-col gap-3">
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3">
                <Avatar size="default">
                  <AvatarFallback>
                    {getUserInitial(user.username)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-medium">{user.username}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </div>
              <Button
                className="justify-start"
                onClick={handleLogout}
                variant="destructive"
              >
                <LogOut />
                Logout
              </Button>
            </div>
          ) : (
            <LoginLink className="justify-start" onNavigate={closeDrawer} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function UserArea() {
  const logout = useServerFn(logoutFn)
  const { user, isAuthenticated, setUser } = useAuth()

  const handleLogout = async () => {
    setUser(null)
    await logout()
  }

  return (
    <>
      <div className="hidden md:flex">
        {isAuthenticated && user ? (
          <UserMenu onLogout={handleLogout} user={user} />
        ) : (
          <LoginLink />
        )}
      </div>
      <MobileNavDrawer
        isAuthenticated={isAuthenticated}
        onLogout={handleLogout}
        user={user}
      />
    </>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <nav className="bg-[#333333] px-4 text-white">
        <div className="mx-auto flex h-12 w-full max-w-5xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link className="text-lg font-semibold" to={brandLink.to}>
              {brandLink.label}
            </Link>
            <DesktopNavLinks />
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

function RootDocument({ children }: { children: ReactNode }) {
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
