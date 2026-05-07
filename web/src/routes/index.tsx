import { Link, createFileRoute } from "@tanstack/react-router"
import { buttonVariants } from "@/components/ui/button"

export const Route = createFileRoute("/")({ component: App })

function App() {
  return (
    <div className="space-y-5">
      <p className="text-sm font-medium text-muted-foreground">RiftBench</p>
      <h1 className="text-4xl font-semibold tracking-normal">
        Build, browse, and tune Riftbound decks.
      </h1>
      <p className="text-muted-foreground">
        Browse public decks, manage your own deck library, and open individual
        deck pages from a single route map.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link to="/browse" className={buttonVariants()}>
          Browse decks
        </Link>
        <Link to="/decks" className={buttonVariants({ variant: "outline" })}>
          My decks
        </Link>
      </div>
    </div>
  )
}
