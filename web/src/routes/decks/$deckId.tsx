import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { getDecksByDeckIdOptions } from "@/client/@tanstack/react-query.gen"
import { useAuth } from "@/lib/auth"
import type { DeckDetailDto } from "@/client/types.gen"

export const Route = createFileRoute("/decks/$deckId")({
  component: DeckRoute,
})

type DeckDetailsProps = {
  deck: DeckDetailDto
}

function DeckDetails({ deck }: DeckDetailsProps) {
  return (
    <>
      <section className="flex justify-between bg-[#222222]">
        <p className="text-sm font-medium text-muted-foreground">
          {deck.username ?? "RiftBench deck"}
        </p>
        <h1 className="text-3xl font-semibold tracking-normal">{deck.name}</h1>
        {deck.description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">
            {deck.description}
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {deck.cards.reduce((total, card) => total + card.quantity, 0)} cards
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {deck.cards.map((deckCard) => (
          <article
            key={`${deckCard.cardId}-${deckCard.categoryId ?? "main"}`}
            className="rounded-lg border bg-card p-4 text-card-foreground"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-medium">{deckCard.card.name}</h2>
              <span className="shrink-0 text-sm font-medium">
                x{deckCard.quantity}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {deckCard.card.setCode} #{deckCard.card.collectorNumber}
            </p>
          </article>
        ))}
      </div>
    </>
  )
}

function DeckRoute() {
  const { deckId } = Route.useParams()
  const { isLoading: isAuthLoading } = useAuth()
  const {
    data: deck,
    isLoading,
    isError,
  } = useQuery({
    ...getDecksByDeckIdOptions({ path: { deckId } }),
    enabled: !isAuthLoading,
  })

  return (
    <div className="flex flex-col gap-8">
      {isAuthLoading || isLoading ? (
        <p className="text-sm text-muted-foreground">Loading deck...</p>
      ) : null}
      {isError ? (
        <p className="text-sm text-destructive">Unable to load this deck.</p>
      ) : null}

      {deck ? <DeckDetails deck={deck} /> : null}
    </div>
  )
}
