import { useEffect, useMemo, useRef, useState } from "react"
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  ArrowDownWideNarrow,
  Check,
  MoreHorizontal,
  Search,
  Settings,
  SquareStack,
} from "lucide-react"
import type { DragEndEvent } from "@dnd-kit/core"
import type { ComponentProps, KeyboardEvent } from "react"
import type {
  CardSummaryDto,
  CardType,
  DeckCardDto,
  DeckCategoryDto,
  DeckDetailDto,
} from "@/client/types.gen"
import {
  getCardsOptions,
  getDecksByDeckIdOptions,
  getDecksByDeckIdQueryKey,
  putDecksByDeckIdCardsMutation,
} from "@/client/@tanstack/react-query.gen"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/decks/$deckId")({
  component: DeckRoute,
})

const SAVE_DELAY_MS = 2500
const QUICK_ADD_SEARCH_DELAY_MS = 300
const TYPE_ORDER: Array<CardType> = [
  "Legend",
  "Rune",
  "Unit",
  "Spell",
  "Gear",
  "Battlefield",
]

type EditableCategory = {
  id: string
  name: string
  sortOrder: number
}

type EditableDeckCard = DeckCardDto & {
  categoryId: string
}

type GroupMode = "category" | "type"
type SortMode = "name" | "energy" | "custom"

function normalizeDeck(deck: DeckDetailDto) {
  const categories = [...deck.categories]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(toEditableCategory)
  const categoriesByName = new Map(
    categories.map((category) => [category.name.toLowerCase(), category])
  )

  for (const deckCard of deck.cards) {
    if (
      deckCard.categoryId &&
      categories.some((category) => category.id === deckCard.categoryId)
    ) {
      continue
    }

    const typeCategory = getOrCreateTypeCategory(
      deckCard.card.type,
      categories,
      categoriesByName
    )
    deckCard.categoryId = typeCategory.id
  }

  const cards = deck.cards.map((deckCard) => ({
    ...deckCard,
    categoryId:
      deckCard.categoryId ??
      getOrCreateTypeCategory(deckCard.card.type, categories, categoriesByName)
        .id,
  }))

  return {
    categories,
    cards: sortCards(cards),
  }
}

function toEditableCategory(category: DeckCategoryDto): EditableCategory {
  return {
    id: category.id,
    name: category.name,
    sortOrder: category.sortOrder,
  }
}

function getOrCreateTypeCategory(
  type: CardType,
  categories: Array<EditableCategory>,
  categoriesByName: Map<string, EditableCategory>
) {
  const existing = categoriesByName.get(type.toLowerCase())
  if (existing) {
    return existing
  }

  const category = {
    id: crypto.randomUUID(),
    name: type,
    sortOrder: getTypeSortOrder(type, categories.length),
  }
  categories.push(category)
  categoriesByName.set(type.toLowerCase(), category)

  return category
}

function getTypeSortOrder(type: CardType, fallback: number) {
  const typeIndex = TYPE_ORDER.indexOf(type)
  return typeIndex === -1 ? fallback : typeIndex
}

function sortCards(cards: Array<EditableDeckCard>) {
  return [...cards].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder || a.card.name.localeCompare(b.card.name)
  )
}

function sortCategories(categories: Array<EditableCategory>) {
  return [...categories].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
  )
}

function DeckRoute() {
  const { deckId } = Route.useParams()
  const { user, isLoading: isAuthLoading } = useAuth()
  const {
    data: deck,
    isLoading,
    isError,
  } = useQuery({
    ...getDecksByDeckIdOptions({ path: { deckId } }),
    enabled: !isAuthLoading,
  })

  return (
    <div className="flex grow flex-col">
      {isAuthLoading || isLoading ? (
        <p className="p-6 text-sm text-muted-foreground">Loading deck...</p>
      ) : null}
      {isError ? (
        <p className="p-6 text-sm text-destructive">
          Unable to load this deck.
        </p>
      ) : null}

      {deck ? (
        <DeckEditor deck={deck} isOwner={user?.userId === deck.userId} />
      ) : null}
    </div>
  )
}

function DeckEditor({
  deck,
  isOwner,
}: {
  deck: DeckDetailDto
  isOwner: boolean
}) {
  const queryClient = useQueryClient()
  const [{ categories, cards }, setDeckState] = useState(() =>
    normalizeDeck(deck)
  )
  const [groupMode, setGroupMode] = useState<GroupMode>("category")
  const [sortMode, setSortMode] = useState<SortMode>("custom")
  const [filter, setFilter] = useState("")
  const [quickAdd, setQuickAdd] = useState("")
  const [debouncedQuickAdd, setDebouncedQuickAdd] = useState("")
  const [selectedQuickAddIndex, setSelectedQuickAddIndex] = useState(0)
  const [dirtyVersion, setDirtyVersion] = useState(0)
  const dirtyRef = useRef(false)
  const latestStateRef = useRef({ categories, cards })
  const queryKey = getDecksByDeckIdQueryKey({ path: { deckId: deck.id } })
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const saveMutation = useMutation({
    ...putDecksByDeckIdCardsMutation(),
    onSuccess: (savedDeck) => {
      dirtyRef.current = false
      queryClient.setQueryData(queryKey, savedDeck)
    },
  })

  const quickAddQuery = useQuery({
    ...getCardsOptions({
      query: {
        Search: debouncedQuickAdd,
        Page: 1,
        PageSize: 3,
        SortBy: "name",
      },
    }),
    enabled: debouncedQuickAdd.trim().length >= 2,
  })

  const quickAddResults = quickAddQuery.data?.items.slice(0, 3) ?? []

  useEffect(() => {
    const normalized = normalizeDeck(deck)
    setDeckState(normalized)
    latestStateRef.current = normalized
    dirtyRef.current = false
  }, [deck])

  useEffect(() => {
    latestStateRef.current = { categories, cards }
  }, [categories, cards])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuickAdd(quickAdd.trim())
    }, QUICK_ADD_SEARCH_DELAY_MS)

    return () => window.clearTimeout(timeout)
  }, [quickAdd])

  useEffect(() => {
    setSelectedQuickAddIndex(0)
  }, [debouncedQuickAdd])

  useEffect(() => {
    if (selectedQuickAddIndex >= quickAddResults.length) {
      setSelectedQuickAddIndex(Math.max(quickAddResults.length - 1, 0))
    }
  }, [quickAddResults.length, selectedQuickAddIndex])

  useEffect(() => {
    if (!isOwner || !dirtyRef.current || dirtyVersion === 0) {
      return
    }

    const timeout = window.setTimeout(() => {
      const state = latestStateRef.current
      saveMutation.mutate({
        path: { deckId: deck.id },
        body: {
          categories: sortCategories(state.categories).map(
            (category, index) => ({
              id: category.id,
              name: category.name,
              sortOrder: index,
            })
          ),
          cards: state.cards.map((deckCard, index) => ({
            cardId: deckCard.cardId,
            categoryId: deckCard.categoryId,
            quantity: deckCard.quantity,
            sortOrder: index,
            notes: deckCard.notes,
          })),
        },
      })
    }, SAVE_DELAY_MS)

    return () => window.clearTimeout(timeout)
  }, [deck.id, dirtyVersion, isOwner, saveMutation])

  const totalQuantity = cards.reduce((total, card) => total + card.quantity, 0)
  const groupedCards = useMemo(
    () => groupCards(categories, cards, groupMode, sortMode, filter),
    [cards, categories, filter, groupMode, sortMode]
  )

  function updateDeckCards(
    updater: (state: {
      categories: Array<EditableCategory>
      cards: Array<EditableDeckCard>
    }) => {
      categories: Array<EditableCategory>
      cards: Array<EditableDeckCard>
    }
  ) {
    setDeckState((current) => {
      const next = updater(current)
      latestStateRef.current = next
      return next
    })
    dirtyRef.current = true
    setDirtyVersion((version) => version + 1)
  }

  function addCard(card: CardSummaryDto) {
    updateDeckCards((current) => {
      const categoriesByName = new Map(
        current.categories.map((category) => [
          category.name.toLowerCase(),
          category,
        ])
      )
      const nextCategories = [...current.categories]
      const typeCategory = getOrCreateTypeCategory(
        card.type,
        nextCategories,
        categoriesByName
      )
      const existing = current.cards.find(
        (deckCard) => deckCard.cardId === card.id
      )

      if (existing) {
        return {
          categories: nextCategories,
          cards: current.cards.map((deckCard) =>
            deckCard.cardId === card.id
              ? { ...deckCard, quantity: deckCard.quantity + 1 }
              : deckCard
          ),
        }
      }

      return {
        categories: nextCategories,
        cards: [
          ...current.cards,
          {
            cardId: card.id,
            categoryId: typeCategory.id,
            quantity: 1,
            sortOrder: current.cards.length,
            notes: null,
            card,
          },
        ],
      }
    })
  }

  function handleQuickAdd() {
    if (quickAddResults.length === 0) {
      return
    }

    const card = quickAddResults[selectedQuickAddIndex]
    addQuickAddCard(card)
  }

  function addQuickAddCard(card: CardSummaryDto) {
    addCard(card)
    setQuickAdd("")
    setDebouncedQuickAdd("")
    setSelectedQuickAddIndex(0)
  }

  function handleQuickAddKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setSelectedQuickAddIndex((index) =>
        quickAddResults.length === 0 ? 0 : (index + 1) % quickAddResults.length
      )
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      setSelectedQuickAddIndex((index) =>
        quickAddResults.length === 0
          ? 0
          : (index - 1 + quickAddResults.length) % quickAddResults.length
      )
      return
    }

    if (event.key === "Enter") {
      event.preventDefault()
      handleQuickAdd()
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id)
    const overId = event.over ? String(event.over.id) : null
    if (
      !overId ||
      !activeId.startsWith("card:") ||
      !isOwner ||
      groupMode !== "category"
    ) {
      return
    }

    const draggedCardId = activeId.replace("card:", "")

    updateDeckCards((current) => {
      const draggedCard = current.cards.find(
        (card) => card.cardId === draggedCardId
      )
      if (!draggedCard) {
        return current
      }

      const targetCardId = overId.startsWith("card:")
        ? overId.replace("card:", "")
        : null
      const targetCard = targetCardId
        ? current.cards.find((card) => card.cardId === targetCardId)
        : null
      const targetCategoryId = overId.startsWith("category:")
        ? overId.replace("category:", "")
        : targetCard?.categoryId

      if (!targetCategoryId) {
        return current
      }

      const remainingCards = current.cards.filter(
        (card) => card.cardId !== draggedCardId
      )
      const targetIndex = targetCard
        ? remainingCards.findIndex((card) => card.cardId === targetCard.cardId)
        : remainingCards.filter((card) => card.categoryId === targetCategoryId)
            .length

      const nextCard = { ...draggedCard, categoryId: targetCategoryId }
      const insertIndex = targetCard
        ? Math.max(targetIndex, 0)
        : remainingCards.length
      const nextCards = [
        ...remainingCards.slice(0, insertIndex),
        nextCard,
        ...remainingCards.slice(insertIndex),
      ].map((card, index) => ({ ...card, sortOrder: index }))

      return {
        categories: current.categories,
        cards: nextCards,
      }
    })
  }

  return (
    <div className="flex grow flex-col gap-4 bg-[#101010] pb-5 text-white">
      <DeckHeader
        deck={deck}
        isOwner={isOwner}
        totalQuantity={totalQuantity}
        isSaving={saveMutation.isPending}
        hasUnsavedChanges={dirtyRef.current}
      />

      {isOwner ? (
        <DeckToolbar
          groupMode={groupMode}
          sortMode={sortMode}
          filter={filter}
          quickAdd={quickAdd}
          quickAddResults={quickAddResults}
          selectedQuickAddIndex={selectedQuickAddIndex}
          onGroupModeChange={setGroupMode}
          onSortModeChange={setSortMode}
          onFilterChange={setFilter}
          onQuickAddChange={setQuickAdd}
          onQuickAddKeyDown={handleQuickAddKeyDown}
          onQuickAddHighlight={setSelectedQuickAddIndex}
          onQuickAddSelect={addQuickAddCard}
        />
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="flex w-full flex-wrap items-start gap-6 bg-[#222222] p-5">
          {groupedCards.map((group) => (
            <CardGroup
              key={group.id}
              group={group}
              canDrag={isOwner && groupMode === "category"}
            />
          ))}
        </div>
      </DndContext>
    </div>
  )
}

function DeckHeader({
  deck,
  isOwner,
  totalQuantity,
  isSaving,
  hasUnsavedChanges,
}: {
  deck: DeckDetailDto
  isOwner: boolean
  totalQuantity: number
  isSaving: boolean
  hasUnsavedChanges: boolean
}) {
  const isLegal = totalQuantity === 40

  return (
    <section className="bg-[#202020] py-5">
      <div className="flex w-full items-end justify-between gap-6 px-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline gap-2">
            <h1 className="text-2xl font-semibold tracking-normal">
              {deck.name}
            </h1>
            <span className="text-lg text-muted-foreground">
              by {deck.username ?? "Unknown"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-base">
            <span>Deck Size: {totalQuantity}</span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5",
                isLegal ? "text-emerald-500" : "text-amber-400"
              )}
            >
              <Check className="size-5" />
              {isLegal ? "Legal" : "Needs 40"}
            </span>
            {isOwner ? (
              <span className="text-sm text-muted-foreground">
                {isSaving
                  ? "Saving..."
                  : hasUnsavedChanges
                    ? "Unsaved changes"
                    : "Saved"}
              </span>
            ) : null}
          </div>
        </div>

        {isOwner ? (
          <Button
            variant="outline"
            className="border-[#3a3a3a] bg-black text-white hover:bg-[#161616]"
          >
            <Settings className="size-4" />
            Settings
          </Button>
        ) : null}
      </div>
    </section>
  )
}

function DeckToolbar({
  groupMode,
  sortMode,
  filter,
  quickAdd,
  quickAddResults,
  selectedQuickAddIndex,
  onGroupModeChange,
  onSortModeChange,
  onFilterChange,
  onQuickAddChange,
  onQuickAddKeyDown,
  onQuickAddHighlight,
  onQuickAddSelect,
}: {
  groupMode: GroupMode
  sortMode: SortMode
  filter: string
  quickAdd: string
  quickAddResults: Array<CardSummaryDto>
  selectedQuickAddIndex: number
  onGroupModeChange: (mode: GroupMode) => void
  onSortModeChange: (mode: SortMode) => void
  onFilterChange: (filter: string) => void
  onQuickAddChange: (value: string) => void
  onQuickAddKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  onQuickAddHighlight: (index: number) => void
  onQuickAddSelect: (card: CardSummaryDto) => void
}) {
  return (
    <section className="grid w-full gap-4 bg-[#242424] p-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <span className="block text-sm font-semibold text-[#d8d8d8]">
            Add Card
          </span>
          <Button
            variant="outline"
            className="border-[#3a3a3a] bg-black text-white hover:bg-[#161616]"
          >
            <Search className="size-4" />
            Card Search
          </Button>
        </div>
        <div className="relative min-w-64 space-y-1.5">
          <span className="text-sm font-semibold text-[#d8d8d8]">
            Quick Add
          </span>
          <Input
            value={quickAdd}
            onChange={(event) => onQuickAddChange(event.target.value)}
            onKeyDown={onQuickAddKeyDown}
            placeholder="Death from Below"
            className="border-[#3a3a3a] bg-black text-white"
          />
          {quickAddResults.length > 0 ? (
            <div className="absolute z-20 mt-1 w-full rounded-lg border border-[#333] bg-[#111] p-1 shadow-xl">
              {quickAddResults.map((card, index) => (
                <button
                  key={card.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-[#252525]",
                    index === selectedQuickAddIndex && "bg-[#252525]"
                  )}
                  onMouseEnter={() => onQuickAddHighlight(index)}
                  onClick={() => {
                    onQuickAddSelect(card)
                  }}
                >
                  <span>{card.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {card.type}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-end gap-3">
        <SquareStack className="mb-2 size-5 text-[#d8d8d8]" />
        <LabeledSelect
          label="Group By"
          value={groupMode}
          onChange={(event) =>
            onGroupModeChange(event.target.value as GroupMode)
          }
        >
          <option value="category">Categories</option>
          <option value="type">Type</option>
        </LabeledSelect>
      </div>

      <div className="flex items-end gap-3">
        <ArrowDownWideNarrow className="mb-2 size-5 text-[#d8d8d8]" />
        <LabeledSelect
          label="Sort By"
          value={sortMode}
          onChange={(event) => onSortModeChange(event.target.value as SortMode)}
        >
          <option value="custom">Manual</option>
          <option value="name">Name</option>
          <option value="energy">Energy</option>
        </LabeledSelect>
      </div>

      <div className="min-w-64 space-y-1.5 self-end">
        <span className="text-sm font-semibold text-[#d8d8d8]">
          Filter Deck
        </span>
        <Input
          value={filter}
          onChange={(event) => onFilterChange(event.target.value)}
          placeholder="Death from Below"
          className="border-[#3a3a3a] bg-black text-white"
        />
      </div>
    </section>
  )
}

function LabeledSelect({
  label,
  children,
  ...props
}: ComponentProps<typeof Select> & { label: string }) {
  return (
    <label className="min-w-48 space-y-1.5">
      <span className="text-sm font-semibold text-[#d8d8d8]">{label}</span>
      <Select {...props} className="border-[#3a3a3a] bg-black text-white">
        {children}
      </Select>
    </label>
  )
}

type CardGroupModel = {
  id: string
  name: string
  quantity: number
  cards: Array<EditableDeckCard>
}

function CardGroup({
  group,
  canDrag,
}: {
  group: CardGroupModel
  canDrag: boolean
}) {
  const droppableId = `category:${group.id}`
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    disabled: !canDrag,
  })
  const itemIds = group.cards.map((card) => `card:${card.cardId}`)

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "min-h-72 w-[180px] transition-colors",
        group.name === "Battlefield" && "w-[300px]",
        isOver && "bg-white/5"
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[#dcdcdc]">{group.name}</h2>
          <p className="text-xs text-muted-foreground">Qty: {group.quantity}</p>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-white hover:bg-white/10"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </div>

      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2">
          {group.cards.map((deckCard) => (
            <DeckCardTile
              key={deckCard.cardId}
              deckCard={deckCard}
              canDrag={canDrag}
            />
          ))}
        </div>
      </SortableContext>
    </section>
  )
}

function DeckCardTile({
  deckCard,
  canDrag,
}: {
  deckCard: EditableDeckCard
  canDrag: boolean
}) {
  const sortable = useSortable({
    id: `card:${deckCard.cardId}`,
    disabled: !canDrag,
  })
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  }
  const isBattlefield = deckCard.card.type === "Battlefield"

  return (
    <article
      ref={sortable.setNodeRef}
      style={style}
      {...sortable.attributes}
      {...sortable.listeners}
      className={cn(
        "relative overflow-hidden rounded-md bg-black shadow-lg ring-1 shadow-black/40 ring-white/10",
        canDrag && "touch-none",
        sortable.isDragging && "z-30 opacity-70 ring-2 ring-primary"
      )}
    >
      <span className="absolute top-1.5 left-1.5 z-10 rounded bg-black/70 px-1.5 py-0.5 text-xs font-semibold text-white">
        {deckCard.quantity}
      </span>
      {deckCard.card.imageUrl ? (
        <img
          src={deckCard.card.imageUrl}
          alt={deckCard.card.name}
          className={cn(
            "block w-full object-cover",
            isBattlefield ? "aspect-[1.62/1]" : "aspect-[0.714/1]"
          )}
          loading="lazy"
        />
      ) : (
        <div
          className={cn(
            "flex w-full items-center justify-center bg-[#151515] p-3 text-center text-xs",
            isBattlefield ? "aspect-[1.62/1]" : "aspect-[0.714/1]"
          )}
        >
          {deckCard.card.name}
        </div>
      )}
    </article>
  )
}

function groupCards(
  categories: Array<EditableCategory>,
  cards: Array<EditableDeckCard>,
  groupMode: GroupMode,
  sortMode: SortMode,
  filter: string
): Array<CardGroupModel> {
  const normalizedFilter = filter.trim().toLowerCase()
  const visibleCards = normalizedFilter
    ? cards.filter((deckCard) =>
        deckCard.card.name.toLowerCase().includes(normalizedFilter)
      )
    : cards

  if (groupMode === "type") {
    return TYPE_ORDER.map((type, index) => ({
      id: `type-${type}`,
      name: type,
      quantity: 0,
      cards: sortCardsForDisplay(
        visibleCards.filter((deckCard) => deckCard.card.type === type),
        sortMode
      ),
      sortOrder: index,
    }))
      .filter((group) => group.cards.length > 0)
      .map(toGroupQuantity)
  }

  const groups = sortCategories(categories).map((category) => ({
    id: category.id,
    name: category.name,
    quantity: 0,
    cards: sortCardsForDisplay(
      visibleCards.filter((deckCard) => deckCard.categoryId === category.id),
      sortMode
    ),
  }))

  return groups.filter((group) => group.cards.length > 0).map(toGroupQuantity)
}

function sortCardsForDisplay(
  cards: Array<EditableDeckCard>,
  sortMode: SortMode
) {
  if (sortMode === "name") {
    return [...cards].sort((a, b) => a.card.name.localeCompare(b.card.name))
  }

  if (sortMode === "energy") {
    return [...cards].sort(
      (a, b) =>
        (a.card.energy ?? Number.MAX_SAFE_INTEGER) -
          (b.card.energy ?? Number.MAX_SAFE_INTEGER) ||
        a.card.name.localeCompare(b.card.name)
    )
  }

  return sortCards(cards)
}

function toGroupQuantity(
  group: Omit<CardGroupModel, "quantity"> & { quantity: number }
) {
  return {
    ...group,
    quantity: group.cards.reduce(
      (total, deckCard) => total + deckCard.quantity,
      0
    ),
  }
}
