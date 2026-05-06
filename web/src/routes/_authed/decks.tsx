import { useQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { buttonVariants } from "@/components/ui/button"
import { getDecksOptions } from "@/client/@tanstack/react-query.gen"
import type { DeckFolderNodeDto, DeckListItemDto } from "@/client"
import { useAuth } from "@/lib/auth"

export const Route = createFileRoute("/_authed/decks")({
  component: DecksRoute,
})

function DecksRoute() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const { data, isLoading, isError } = useQuery({
    ...getDecksOptions({
      headers: user ? { Authorization: `Bearer ${user.accessToken}` } : undefined,
    }),
    enabled: !!user,
  })
  const decks = [...(data?.decks ?? []), ...flattenFolderDecks(data?.folders ?? [])]

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-8 px-6 py-12">
      <nav className="flex flex-wrap items-center gap-3 text-sm">
        <Link to="/" className={buttonVariants({ variant: "ghost" })}>Home</Link>
        <Link to="/browse" className={buttonVariants({ variant: "ghost" })}>Browse</Link>
      </nav>

      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-normal">Decks</h1>
        <p className="text-sm text-muted-foreground">Your RiftBench decks.</p>
      </section>

      {isAuthLoading || isLoading ? <p className="text-sm text-muted-foreground">Loading your decks...</p> : null}
      {isError ? <p className="text-sm text-destructive">Unable to load your decks.</p> : null}

      {decks.length === 0 && !isAuthLoading && !isLoading ? <p className="text-sm text-muted-foreground">No decks found.</p> : null}

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
          </Link>
        ))}
      </div>
    </main>
  )
}

function flattenFolderDecks(folders: Array<DeckFolderNodeDto>): Array<DeckListItemDto> {
  return folders.flatMap((folder) => [
    ...folder.decks,
    ...flattenFolderDecks(folder.children),
  ])
}
