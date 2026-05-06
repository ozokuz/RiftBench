import { useQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { buttonVariants } from "@/components/ui/button"
import { getDecksBrowseOptions } from "@/client/@tanstack/react-query.gen"

export const Route = createFileRoute("/browse")({
  component: BrowseRoute,
})

function BrowseRoute() {
  const { data, isLoading, isError } = useQuery(
    getDecksBrowseOptions({ query: { page: 1, pageSize: 50 } }),
  )

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-8 px-6 py-12">
      <PageNav />
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-normal">Browse</h1>
        <p className="text-sm text-muted-foreground">Public RiftBench decks.</p>
      </section>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading decks...</p> : null}
      {isError ? <p className="text-sm text-destructive">Unable to load public decks.</p> : null}

      <DeckList decks={data?.items ?? []} />
    </main>
  )
}

function PageNav() {
  return (
    <nav className="flex flex-wrap items-center gap-3 text-sm">
      <Link to="/" className={buttonVariants({ variant: "ghost" })}>Home</Link>
      <Link to="/decks" className={buttonVariants({ variant: "ghost" })}>Decks</Link>
      <Link to="/login" className={buttonVariants({ variant: "outline" })}>Login</Link>
    </nav>
  )
}

function DeckList({ decks }: { decks: Array<{ id: string; name: string; description: string | null; cardCount: number; totalQuantity: number; username: string | null }> }) {
  if (decks.length === 0) {
    return <p className="text-sm text-muted-foreground">No public decks found.</p>
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {decks.map((deck) => (
        <Link
          key={deck.id}
          to="/decks/$deckId"
          params={{ deckId: deck.id }}
          className="rounded-lg border bg-card p-4 text-card-foreground transition-colors hover:bg-accent"
        >
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-medium">{deck.name}</h2>
            <span className="shrink-0 text-xs text-muted-foreground">{deck.totalQuantity} cards</span>
          </div>
          {deck.description ? <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{deck.description}</p> : null}
          <p className="mt-3 text-xs text-muted-foreground">{deck.username ?? "Unknown player"}</p>
        </Link>
      ))}
    </div>
  )
}
