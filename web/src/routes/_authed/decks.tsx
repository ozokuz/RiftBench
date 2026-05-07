import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { Folder, Library, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DeckVisibility } from "@/client"
import { getDecksOptions, getDecksQueryKey, postDecksMutation } from "@/client/@tanstack/react-query.gen"
import type { DeckFolderNodeDto, DeckListItemDto } from "@/client"

export const Route = createFileRoute("/_authed/decks")({
  component: DecksRoute,
})

function DecksRoute() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data, isLoading, isError } = useQuery(getDecksOptions())
  const createDeck = useMutation({
    ...postDecksMutation(),
    onSuccess: async (deck) => {
      await queryClient.invalidateQueries({ queryKey: getDecksQueryKey() })
      await navigate({ to: "/decks/$deckId", params: { deckId: deck.id } })
    },
  })
  const folders = flattenFolders(data?.folders ?? [])
  const decks = [...(data?.decks ?? []), ...flattenFolderDecks(data?.folders ?? [])]
  const hasItems = folders.length > 0 || decks.length > 0

  function handleCreateDeck() {
    createDeck.mutate({
      body: {
        name: "New deck",
        description: null,
        folderId: null,
        visibility: DeckVisibility.PRIVATE,
      },
    })
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <section className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-normal">Decks</h1>
          <p className="text-sm text-muted-foreground">Your RiftBench decks.</p>
        </section>
        <Button onClick={handleCreateDeck} disabled={createDeck.isPending}>
          <Plus data-icon="inline-start" />
          {createDeck.isPending ? "Creating..." : "New deck"}
        </Button>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading your decks...</p> : null}
      {isError ? <p className="text-sm text-destructive">Unable to load your decks.</p> : null}
      {createDeck.isError ? <p className="text-sm text-destructive">Unable to create a new deck.</p> : null}

      {!hasItems && !isLoading ? <p className="text-sm text-muted-foreground">No decks found.</p> : null}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {folders.map((folder) => (
          <div
            key={folder.id}
            className="flex aspect-square flex-col items-center justify-center rounded-lg border bg-card p-4 text-center text-card-foreground"
          >
            <Folder className="mb-4 size-14 text-muted-foreground" strokeWidth={1.6} />
            <h2 className="line-clamp-2 text-sm font-medium">{folder.name}</h2>
          </div>
        ))}
        {decks.map((deck) => (
          <Link
            key={deck.id}
            to="/decks/$deckId"
            params={{ deckId: deck.id }}
            className="flex aspect-square flex-col items-center justify-center rounded-lg border bg-card p-4 text-center text-card-foreground transition-colors hover:bg-accent"
          >
            <Library className="mb-4 size-14 text-muted-foreground" strokeWidth={1.6} />
            <h2 className="line-clamp-2 text-sm font-medium">{deck.name}</h2>
          </Link>
        ))}
      </div>
    </div>
  )
}

function flattenFolders(folders: Array<DeckFolderNodeDto>): Array<DeckFolderNodeDto> {
  return folders.flatMap((folder) => [
    folder,
    ...flattenFolders(folder.children),
  ])
}

function flattenFolderDecks(folders: Array<DeckFolderNodeDto>): Array<DeckListItemDto> {
  return folders.flatMap((folder) => [
    ...folder.decks,
    ...flattenFolderDecks(folder.children),
  ])
}
