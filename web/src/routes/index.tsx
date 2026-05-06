import { Link, createFileRoute } from "@tanstack/react-router"
import { buttonVariants } from "@/components/ui/button"

export const Route = createFileRoute("/")({ component: App })

function App() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-8 px-6 py-12">
      <nav className="flex flex-wrap items-center gap-3 text-sm">
        <Link to="/" className={buttonVariants({ variant: "ghost" })}>Home</Link>
        <Link to="/browse" className={buttonVariants({ variant: "ghost" })}>Browse</Link>
        <Link to="/decks" className={buttonVariants({ variant: "ghost" })}>Decks</Link>
        <Link to="/login" className={buttonVariants()}>Login</Link>
      </nav>

      <div className="max-w-2xl space-y-5">
        <p className="text-sm font-medium text-muted-foreground">RiftBench</p>
        <h1 className="text-4xl font-semibold tracking-normal">Build, browse, and tune Riftbound decks.</h1>
        <p className="text-muted-foreground">
          Browse public decks, manage your own deck library, and open individual deck pages from a single route map.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link to="/browse" className={buttonVariants()}>Browse decks</Link>
          <Link to="/decks" className={buttonVariants({ variant: "outline" })}>My decks</Link>
        </div>
      </div>
    </main>
  )
}
