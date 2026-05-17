import { useEffect, useMemo, useRef, useState } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  ArrowDownWideNarrow,
  Check,
  Minus,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  SquareStack,
} from "lucide-react"
import type { DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core"
import type { ComponentProps, FormEvent, KeyboardEvent } from "react"
import type {
  CardDomain,
  CardRarity,
  CardSummaryDto,
  CardSupertype,
  CardType,
  DeckCardDto,
  DeckCategoryDto,
  DeckDetailDto,
  DeckFolderNodeDto,
  DeckVisibility,
  DomainFilterMode,
} from "@/client/types.gen"
import {
  CardDomain as CardDomainValues,
  CardRarity as CardRarityValues,
  CardSupertype as CardSupertypeValues,
  CardType as CardTypeValues,
  DeckVisibility as DeckVisibilityValues,
  DomainFilterMode as DomainFilterModeValues,
} from "@/client/types.gen"
import { client as apiClient } from "@/client/client.gen"
import {
  getCardsOptions,
  getDecksByDeckIdOptions,
  getDecksByDeckIdQueryKey,
  getDecksOptions,
  putDecksByDeckIdCardsMutation,
  putDecksByDeckIdSettingsMutation,
} from "@/client/@tanstack/react-query.gen"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/decks/$deckId")({
  component: DeckRoute,
})

const SAVE_DELAY_MS = 2500
const QUICK_ADD_SEARCH_DELAY_MS = 300
const CARD_SEARCH_DELAY_MS = 300
const SEARCH_RESULT_PAGE_SIZE = 24
const CATEGORY_NAME_MAX_LENGTH = 128
const TYPE_ORDER: Array<CardType> = [
  "Legend",
  "Rune",
  "Unit",
  "Spell",
  "Gear",
  "Battlefield",
]
const DOMAIN_OPTIONS = [
  CardDomainValues.FURY,
  CardDomainValues.CALM,
  CardDomainValues.MIND,
  CardDomainValues.CHAOS,
  CardDomainValues.BODY,
  CardDomainValues.ORDER,
]
const RARITY_OPTIONS = [
  CardRarityValues.COMMON,
  CardRarityValues.UNCOMMON,
  CardRarityValues.RARE,
  CardRarityValues.EPIC,
  CardRarityValues.PROMO,
]
const TYPE_OPTIONS = Object.values(CardTypeValues)
const SUPERTYPE_OPTIONS = Object.values(CardSupertypeValues)

type EditableCategory = {
  id: string
  name: string
  sortOrder: number
}

type EditableDeckCard = DeckCardDto & {
  categoryId: string
}

type CardDetailDto = CardSummaryDto & {
  richText: null | string
  plainText: null | string
  flavourText: null | string
  artist: null | string
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

function validateCategoryName(
  name: string,
  categories: Array<EditableCategory>,
  currentCategoryId?: string
) {
  const trimmedName = name.trim()
  if (trimmedName.length === 0) {
    return "Category name is required."
  }

  if (trimmedName.length > CATEGORY_NAME_MAX_LENGTH) {
    return `Category name must be ${CATEGORY_NAME_MAX_LENGTH} characters or fewer.`
  }

  const normalizedName = trimmedName.toLowerCase()
  const duplicateExists = categories.some(
    (category) =>
      category.id !== currentCategoryId &&
      category.name.trim().toLowerCase() === normalizedName
  )
  if (duplicateExists) {
    return "Category names must be unique."
  }

  return null
}

function buildNewCategory(
  name: string,
  categories: Array<EditableCategory>
): EditableCategory {
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    sortOrder: categories.length,
  }
}

function pruneEmptyCategories(
  categories: Array<EditableCategory>,
  cards: Array<EditableDeckCard>
) {
  const usedCategoryIds = new Set(cards.map((card) => card.categoryId))
  return categories.filter((category) => usedCategoryIds.has(category.id))
}

function DeckRoute() {
  const { deckId } = Route.useParams()
  const { user, isLoading: isAuthLoading } = useAuth()
  const {
    data: deck,
    isLoading,
    isError,
  } = useQuery({
    ...getDecksByDeckIdOptions({
      path: { deckId },
      headers: user ? { Authorization: `Bearer ${user.accessToken}` } : undefined,
    }),
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
  const [isCardSearchOpen, setIsCardSearchOpen] = useState(false)
  const [selectedDetailCardId, setSelectedDetailCardId] = useState<
    string | null
  >(null)
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null)
  const [isCreateCategoryTargetActive, setIsCreateCategoryTargetActive] =
    useState(false)
  const [pendingCreateCategoryCardId, setPendingCreateCategoryCardId] =
    useState<string | null>(null)
  const [isCreateCategoryDialogOpen, setIsCreateCategoryDialogOpen] =
    useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [createCategoryError, setCreateCategoryError] = useState<string | null>(
    null
  )
  const [renamingCategoryId, setRenamingCategoryId] = useState<string | null>(
    null
  )
  const [renameDraft, setRenameDraft] = useState("")
  const [renameError, setRenameError] = useState<string | null>(null)
  const [openCategoryMenuId, setOpenCategoryMenuId] = useState<string | null>(
    null
  )
  const [hoveredCategoryId, setHoveredCategoryId] = useState<string | null>(
    null
  )
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [dirtyVersion, setDirtyVersion] = useState(0)
  const dirtyRef = useRef(false)
  const latestStateRef = useRef({ categories, cards })
  const queryKey = getDecksByDeckIdQueryKey({ path: { deckId: deck.id } })
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const { user } = useAuth()

  const saveMutation = useMutation({
    ...putDecksByDeckIdCardsMutation(),
    onSuccess: (savedDeck) => {
      dirtyRef.current = false
      queryClient.setQueryData(queryKey, savedDeck)
    },
  })

  const { data: deckTree } = useQuery({
    ...getDecksOptions({
      headers: user ? { Authorization: `Bearer ${user.accessToken}` } : undefined,
    }),
    enabled: isOwner && !!user,
  })

  const allFolderOptions = useMemo(() => {
    if (!deckTree) return []
    return flattenFolderNodes(deckTree.folders)
  }, [deckTree])

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
    setDraggedCardId(null)
    setHoveredCategoryId(null)
    setIsCreateCategoryTargetActive(false)
    setPendingCreateCategoryCardId(null)
    setIsCreateCategoryDialogOpen(false)
    setNewCategoryName("")
    setCreateCategoryError(null)
    setRenamingCategoryId(null)
    setRenameDraft("")
    setRenameError(null)
    setOpenCategoryMenuId(null)
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
    if (groupMode === "category") {
      return
    }

    setDraggedCardId(null)
    setHoveredCategoryId(null)
    setIsCreateCategoryTargetActive(false)
    setOpenCategoryMenuId(null)
    setRenamingCategoryId(null)
    setRenameDraft("")
    setRenameError(null)
    setPendingCreateCategoryCardId(null)
    setIsCreateCategoryDialogOpen(false)
    setNewCategoryName("")
    setCreateCategoryError(null)
  }, [groupMode])

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
  const draggedCard = draggedCardId
    ? cards.find((card) => card.cardId === draggedCardId)
    : undefined

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

  function changeDeckCardQuantity(cardId: string, delta: number) {
    updateDeckCards((current) => {
      const nextCards = current.cards
        .map((deckCard) =>
          deckCard.cardId === cardId
            ? { ...deckCard, quantity: deckCard.quantity + delta }
            : deckCard
        )
        .filter((deckCard) => deckCard.quantity > 0)

      return {
        categories: pruneEmptyCategories(current.categories, nextCards),
        cards: nextCards,
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

  function closeCreateCategoryDialog() {
    setIsCreateCategoryDialogOpen(false)
    setPendingCreateCategoryCardId(null)
    setNewCategoryName("")
    setCreateCategoryError(null)
  }

  function createCategory() {
    if (!pendingCreateCategoryCardId) {
      closeCreateCategoryDialog()
      return
    }

    const validationError = validateCategoryName(newCategoryName, categories)
    if (validationError) {
      setCreateCategoryError(validationError)
      return
    }

    updateDeckCards((current) => {
      const droppedCard = current.cards.find(
        (card) => card.cardId === pendingCreateCategoryCardId
      )
      if (!droppedCard) {
        return current
      }

      const nextCategory = buildNewCategory(newCategoryName, current.categories)
      const remainingCards = current.cards.filter(
        (card) => card.cardId !== pendingCreateCategoryCardId
      )
      const nextCards = [
        ...remainingCards,
        {
          ...droppedCard,
          categoryId: nextCategory.id,
        },
      ].map((card, index) => ({
        ...card,
        sortOrder: index,
      }))
      const nextCategories = pruneEmptyCategories(
        [...current.categories, nextCategory],
        nextCards
      )

      return {
        categories: nextCategories,
        cards: nextCards,
      }
    })

    closeCreateCategoryDialog()
  }

  function startRenamingCategory(categoryId: string) {
    const category = categories.find((item) => item.id === categoryId)
    if (!category) {
      return
    }

    setOpenCategoryMenuId(null)
    setRenamingCategoryId(categoryId)
    setRenameDraft(category.name)
    setRenameError(null)
  }

  function cancelRenamingCategory() {
    setRenamingCategoryId(null)
    setRenameDraft("")
    setRenameError(null)
  }

  function submitCategoryRename(categoryId: string) {
    const validationError = validateCategoryName(
      renameDraft,
      categories,
      categoryId
    )
    if (validationError) {
      setRenameError(validationError)
      return
    }

    updateDeckCards((current) => ({
      categories: current.categories.map((category) =>
        category.id === categoryId
          ? { ...category, name: renameDraft.trim() }
          : category
      ),
      cards: current.cards,
    }))

    cancelRenamingCategory()
  }

  function handleDragStart(event: DragStartEvent) {
    const activeId = String(event.active.id)
    if (!activeId.startsWith("card:")) {
      return
    }

    const nextDraggedCardId = activeId.replace("card:", "")
    setDraggedCardId(nextDraggedCardId)
    setIsCreateCategoryTargetActive(isOwner && groupMode === "category")
    setOpenCategoryMenuId(null)
    setHoveredCategoryId(
      cards.find((card) => card.cardId === nextDraggedCardId)?.categoryId ??
        null
    )
  }

  function handleDragOver(event: DragOverEvent) {
    const overId = event.over ? String(event.over.id) : null
    if (overId === "action:create-category") {
      setHoveredCategoryId(null)
      return
    }

    setHoveredCategoryId(
      overId?.startsWith("category:") ? overId.replace("category:", "") : null
    )
  }

  function clearDragState() {
    setDraggedCardId(null)
    setHoveredCategoryId(null)
    setIsCreateCategoryTargetActive(false)
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
      clearDragState()
      return
    }

    const droppedCardId = activeId.replace("card:", "")
    if (overId === "action:create-category") {
      setPendingCreateCategoryCardId(droppedCardId)
      setIsCreateCategoryDialogOpen(true)
      setNewCategoryName("")
      setCreateCategoryError(null)
      clearDragState()
      return
    }

    updateDeckCards((current) => {
      const droppedCard = current.cards.find(
        (card) => card.cardId === droppedCardId
      )
      if (!droppedCard) {
        return current
      }

      const targetCategoryId = overId.startsWith("category:")
        ? overId.replace("category:", "")
        : null

      if (!targetCategoryId) {
        return current
      }

      const remainingCards = current.cards.filter(
        (card) => card.cardId !== droppedCardId
      )

      const nextCard = { ...droppedCard, categoryId: targetCategoryId }
      const nextCards = [...remainingCards, nextCard].map((card, index) => ({
        ...card,
        sortOrder: index,
      }))

      return {
        categories: pruneEmptyCategories(current.categories, nextCards),
        cards: nextCards,
      }
    })
    clearDragState()
  }

  return (
    <div className="flex grow flex-col gap-4 bg-[#101010] pb-5 text-white">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={clearDragState}
      >
        <DeckHeader
          deck={deck}
          isOwner={isOwner}
          totalQuantity={totalQuantity}
          isSaving={saveMutation.isPending}
          hasUnsavedChanges={dirtyRef.current}
          onSettingsClick={() => setIsSettingsOpen(true)}
        />

        {isOwner ? (
          <DeckToolbar
            groupMode={groupMode}
            sortMode={sortMode}
            filter={filter}
            quickAdd={quickAdd}
            quickAddResults={quickAddResults}
            selectedQuickAddIndex={selectedQuickAddIndex}
            showCreateCategoryDropZone={isCreateCategoryTargetActive}
            createCategoryDropZoneDisabled={groupMode !== "category"}
            onGroupModeChange={setGroupMode}
            onSortModeChange={setSortMode}
            onFilterChange={setFilter}
            onQuickAddChange={setQuickAdd}
            onQuickAddKeyDown={handleQuickAddKeyDown}
            onQuickAddHighlight={setSelectedQuickAddIndex}
            onQuickAddSelect={addQuickAddCard}
            onOpenCardSearch={() => setIsCardSearchOpen(true)}
          />
        ) : null}

        <div className="flex w-full flex-wrap items-start gap-6 bg-[#222222] p-5">
          {groupedCards.map((group) => (
            <CardGroup
              key={group.id}
              group={group}
              canDrag={isOwner && groupMode === "category"}
              draggedCardId={draggedCardId}
              placeholderCard={
                hoveredCategoryId === group.id ? draggedCard : undefined
              }
              isRenaming={renamingCategoryId === group.id}
              renameValue={renamingCategoryId === group.id ? renameDraft : ""}
              renameError={renamingCategoryId === group.id ? renameError : null}
              isMenuOpen={openCategoryMenuId === group.id}
              onRenameValueChange={setRenameDraft}
              onRenameSubmit={submitCategoryRename}
              onRenameCancel={cancelRenamingCategory}
              onMenuOpenChange={(open) =>
                setOpenCategoryMenuId(open ? group.id : null)
              }
              onStartRename={startRenamingCategory}
              onChangeQuantity={changeDeckCardQuantity}
              onOpenCardDetails={setSelectedDetailCardId}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {draggedCard ? <DeckCardDragPreview deckCard={draggedCard} /> : null}
        </DragOverlay>
      </DndContext>
      <CardSearchDialog
        open={isCardSearchOpen}
        onOpenChange={setIsCardSearchOpen}
        onAddCard={addCard}
      />
      <CreateCategoryDialog
        open={isCreateCategoryDialogOpen}
        name={newCategoryName}
        error={createCategoryError}
        onNameChange={(value) => {
          setNewCategoryName(value)
          if (createCategoryError) {
            setCreateCategoryError(null)
          }
        }}
        onOpenChange={(open) => {
          if (!open) {
            closeCreateCategoryDialog()
          }
        }}
        onSubmit={createCategory}
      />
      <CardDetailsDialog
        cardId={selectedDetailCardId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDetailCardId(null)
          }
        }}
      />
      <DeckSettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        deck={deck}
        folderOptions={allFolderOptions}
      />
    </div>
  )
}

function DeckHeader({
  deck,
  isOwner,
  totalQuantity,
  isSaving,
  hasUnsavedChanges,
  onSettingsClick,
}: {
  deck: DeckDetailDto
  isOwner: boolean
  totalQuantity: number
  isSaving: boolean
  hasUnsavedChanges: boolean
  onSettingsClick?: () => void
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
            onClick={onSettingsClick}
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
  showCreateCategoryDropZone,
  createCategoryDropZoneDisabled,
  onGroupModeChange,
  onSortModeChange,
  onFilterChange,
  onQuickAddChange,
  onQuickAddKeyDown,
  onQuickAddHighlight,
  onQuickAddSelect,
  onOpenCardSearch,
}: {
  groupMode: GroupMode
  sortMode: SortMode
  filter: string
  quickAdd: string
  quickAddResults: Array<CardSummaryDto>
  selectedQuickAddIndex: number
  showCreateCategoryDropZone: boolean
  createCategoryDropZoneDisabled: boolean
  onGroupModeChange: (mode: GroupMode) => void
  onSortModeChange: (mode: SortMode) => void
  onFilterChange: (filter: string) => void
  onQuickAddChange: (value: string) => void
  onQuickAddKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  onQuickAddHighlight: (index: number) => void
  onQuickAddSelect: (card: CardSummaryDto) => void
  onOpenCardSearch: () => void
}) {
  return (
    <section className="w-full bg-[#242424] p-3">
      {showCreateCategoryDropZone ? (
        <CreateCategoryDropZone disabled={createCategoryDropZoneDisabled} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <span className="block text-sm font-semibold text-[#d8d8d8]">
                Add Card
              </span>
              <Button
                variant="outline"
                onClick={onOpenCardSearch}
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
              onChange={(event) =>
                onSortModeChange(event.target.value as SortMode)
              }
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
        </div>
      )}
    </section>
  )
}

function CreateCategoryDropZone({
  disabled,
}: {
  disabled: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "action:create-category",
    disabled,
  })

  return (
    <div className="flex min-h-[92px] items-center justify-center">
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-16 w-full max-w-md items-center justify-center rounded-xl border border-dashed px-5 py-4 text-center transition",
          isOver
            ? "border-emerald-400 bg-emerald-500/10 text-emerald-100"
            : "border-[#4a4a4a] bg-[#171717] text-[#d8d8d8]"
        )}
      >
        <p className="text-sm font-semibold uppercase tracking-[0.2em]">
          {isOver
            ? "Release to name and create a new category"
            : "Drop card here to create category"}
        </p>
      </div>
    </div>
  )
}

function CreateCategoryDialog({
  open,
  name,
  error,
  onNameChange,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  name: string
  error: string | null
  onNameChange: (value: string) => void
  onOpenChange: (open: boolean) => void
  onSubmit: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-[#2f2f2f] bg-[#222222] p-6 text-white">
        <DialogTitle className="text-2xl font-semibold tracking-normal">
          Create Category
        </DialogTitle>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Choose a name for the new category before moving the dropped card
            into it.
          </p>
          <Input
            autoFocus
            value={name}
            maxLength={CATEGORY_NAME_MAX_LENGTH}
            placeholder="New Category"
            onChange={(event) => onNameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                onSubmit()
              }
            }}
            className="border-[#4a4a4a] bg-black text-white"
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-[#3a3a3a] bg-black text-white hover:bg-[#161616]"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-white text-black hover:bg-[#dddddd]"
              onClick={onSubmit}
            >
              Create
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

type CardSearchFilters = {
  search: string
  domains: Array<CardDomain>
  domainMode: DomainFilterMode
  rarities: Array<CardRarity>
  type: "" | CardType
  supertype: "" | CardSupertype
  energy: string
  might: string
}

function snapshotCardSearchFilters(
  filters: CardSearchFilters
): CardSearchFilters {
  return {
    ...filters,
    search: filters.search.trim(),
    domains: [...filters.domains],
    rarities: [...filters.rarities],
    energy: filters.energy.trim(),
    might: filters.might.trim(),
  }
}

function toCardSearchQuery(filters: CardSearchFilters) {
  return {
    Search: filters.search || undefined,
    Domains: filters.domains.length > 0 ? filters.domains : undefined,
    DomainMode: filters.domains.length > 0 ? filters.domainMode : undefined,
    Rarities: filters.rarities.length > 0 ? filters.rarities : undefined,
    Types: filters.type ? [filters.type] : undefined,
    Supertypes: filters.supertype ? [filters.supertype] : undefined,
    Energy: filters.energy || undefined,
    Might: filters.might || undefined,
    Page: 1,
    PageSize: SEARCH_RESULT_PAGE_SIZE,
    SortBy: "name",
  }
}

const DEFAULT_CARD_SEARCH_FILTERS: CardSearchFilters = {
  search: "",
  domains: [],
  domainMode: DomainFilterModeValues.OR,
  rarities: [],
  type: "",
  supertype: "",
  energy: "",
  might: "",
}

function CardSearchDialog({
  open,
  onOpenChange,
  onAddCard,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddCard: (card: CardSummaryDto) => void
}) {
  const [filters, setFilters] = useState<CardSearchFilters>(
    DEFAULT_CARD_SEARCH_FILTERS
  )
  const [submittedFilters, setSubmittedFilters] =
    useState<CardSearchFilters | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const searchQuery = useQuery({
    ...getCardsOptions({
      query: submittedFilters ? toCardSearchQuery(submittedFilters) : undefined,
    }),
    enabled: open && submittedFilters !== null,
  })

  useEffect(() => {
    if (!open || !hasSearched) {
      return
    }

    const timeout = window.setTimeout(() => {
      setSubmittedFilters(snapshotCardSearchFilters(filters))
    }, CARD_SEARCH_DELAY_MS)

    return () => window.clearTimeout(timeout)
  }, [filters, hasSearched, open])

  function updateFilter<TFilter extends keyof CardSearchFilters>(
    key: TFilter,
    value: CardSearchFilters[TFilter]
  ) {
    setFilters((current) => ({ ...current, [key]: value }))
    setHasSearched(true)
  }

  function toggleDomain(domain: CardDomain) {
    updateFilter(
      "domains",
      filters.domains.includes(domain)
        ? filters.domains.filter((item) => item !== domain)
        : [...filters.domains, domain]
    )
  }

  function toggleRarity(rarity: CardRarity) {
    updateFilter(
      "rarities",
      filters.rarities.includes(rarity)
        ? filters.rarities.filter((item) => item !== rarity)
        : [...filters.rarities, rarity]
    )
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setHasSearched(true)
    setSubmittedFilters(snapshotCardSearchFilters(filters))
  }

  function handleAddSearchResult(card: CardSummaryDto) {
    onAddCard(card)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-3rem)] max-w-[1280px] overflow-y-auto border-[#2f2f2f] bg-[#222222] p-7 text-white">
        <DialogTitle className="text-4xl font-normal tracking-normal">
          Card Search
        </DialogTitle>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="flex gap-3">
            <Input
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              placeholder="Card Search"
              className="h-9 border-[#4a4a4a] bg-black text-white"
            />
            <Button
              type="submit"
              variant="outline"
              className="h-9 border-[#4a4a4a] bg-black px-4 text-white hover:bg-[#161616]"
            >
              <Search className="size-4" />
              Search
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-xl">
            <IconToggleGroup
              label="Domains:"
              values={DOMAIN_OPTIONS}
              selectedValues={filters.domains}
              iconPath={(domain) => `/icons/domain/${domain}.png`}
              onToggle={toggleDomain}
            />
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xl">Logic:</span>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={filters.domainMode === DomainFilterModeValues.OR}
                  onChange={() =>
                    updateFilter("domainMode", DomainFilterModeValues.OR)
                  }
                />
                Or
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={filters.domainMode === DomainFilterModeValues.AND}
                  onChange={() =>
                    updateFilter("domainMode", DomainFilterModeValues.AND)
                  }
                />
                And
              </label>
            </div>
          </div>

          <IconToggleGroup
            label="Rarity:"
            values={RARITY_OPTIONS}
            selectedValues={filters.rarities}
            iconPath={(rarity) =>
              rarity === CardRarityValues.PROMO
                ? "/icons/rarity/OverNumbered.png"
                : `/icons/rarity/${rarity}.png`
            }
            onToggle={toggleRarity}
          />

          <div className="grid max-w-[680px] gap-3 sm:grid-cols-2">
            <Select
              value={filters.type}
              onChange={(event) =>
                updateFilter("type", event.target.value as "" | CardType)
              }
              className="border-[#4a4a4a] bg-black text-white"
            >
              <option value="">Type</option>
              {TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
            <Select
              value={filters.supertype}
              onChange={(event) =>
                updateFilter(
                  "supertype",
                  event.target.value as "" | CardSupertype
                )
              }
              className="border-[#4a4a4a] bg-black text-white"
            >
              <option value="">Supertype</option>
              {SUPERTYPE_OPTIONS.map((supertype) => (
                <option key={supertype} value={supertype}>
                  {supertype}
                </option>
              ))}
            </Select>
            <Input
              value={filters.energy}
              onChange={(event) => updateFilter("energy", event.target.value)}
              placeholder="Energy Cost (e.g. >=5)"
              className="border-[#4a4a4a] bg-black text-white"
            />
            <Input
              value={filters.might}
              onChange={(event) => updateFilter("might", event.target.value)}
              placeholder="Might (e.g. <4)"
              className="border-[#4a4a4a] bg-black text-white"
            />
          </div>
        </form>

        <section className="space-y-3">
          <h2 className="text-3xl font-normal tracking-normal">Results</h2>
          {searchQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Searching cards...</p>
          ) : null}
          {searchQuery.isError ? (
            <p className="text-sm text-destructive">Unable to search cards.</p>
          ) : null}
          {submittedFilters && !searchQuery.isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {(searchQuery.data?.items ?? []).map((card) => (
                <button
                  key={card.id}
                  type="button"
                  className="group overflow-hidden rounded-md bg-black text-left ring-1 ring-white/10 transition hover:ring-primary"
                  onClick={() => handleAddSearchResult(card)}
                >
                  {card.imageUrl ? (
                    <img
                      src={card.imageUrl}
                      alt={card.name}
                      className="aspect-[0.714/1] w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex aspect-[0.714/1] items-center justify-center p-3 text-center text-sm">
                      {card.name}
                    </div>
                  )}
                  <div className="p-2">
                    <p className="line-clamp-1 text-sm font-medium">
                      {card.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{card.type}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </section>
      </DialogContent>
    </Dialog>
  )
}

function CardDetailsDialog({
  cardId,
  onOpenChange,
}: {
  cardId: string | null
  onOpenChange: (open: boolean) => void
}) {
  const detailQuery = useQuery({
    queryKey: ["card-detail", cardId],
    queryFn: async () => {
      const { data } = await apiClient.get<
        { 200: CardDetailDto },
        unknown,
        true
      >({
        url: "/cards/{cardId}",
        path: { cardId: cardId! },
        throwOnError: true,
      })

      return data
    },
    enabled: cardId !== null,
  })
  const card = detailQuery.data

  return (
    <Dialog open={cardId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[1680px] overflow-y-auto border-[#2f2f2f] bg-[#222222] p-9 text-white">
        <DialogTitle className="text-5xl font-normal tracking-normal">
          {card?.name ?? "Card Details"}
        </DialogTitle>

        {detailQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading card...</p>
        ) : null}
        {detailQuery.isError ? (
          <p className="text-sm text-destructive">Unable to load card.</p>
        ) : null}

        {card ? (
          <div className="grid gap-14 lg:grid-cols-[480px_1fr]">
            <div className="max-w-[480px] overflow-hidden rounded-2xl bg-black">
              {card.imageUrl ? (
                <img
                  src={card.imageUrl}
                  alt={card.name}
                  className="w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[0.714/1] items-center justify-center p-6 text-center text-xl">
                  {card.name}
                </div>
              )}
            </div>

            <section className="min-h-[660px] rounded-lg bg-[#333333] p-7">
              <div className="flex items-start justify-between gap-6">
                <div className="space-y-2">
                  <h2 className="text-3xl font-normal tracking-normal">
                    {card.name}
                  </h2>
                  <p className="text-2xl text-muted-foreground">{card.type}</p>
                </div>
                <DomainIconRow domains={card.domains} />
              </div>

              <div className="mt-5 space-y-3 text-2xl">
                <p>Card Text:</p>
                <p className="max-w-4xl leading-snug whitespace-pre-line">
                  {card.plainText ?? card.richText ?? "No card text."}
                </p>
              </div>

              {card.flavourText ? (
                <p className="mt-6 max-w-4xl text-lg whitespace-pre-line text-muted-foreground italic">
                  {card.flavourText}
                </p>
              ) : null}
            </section>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function DomainIconRow({ domains }: { domains: Array<CardDomain> }) {
  if (domains.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-3">
      {domains.map((domain) => (
        <img
          key={domain}
          src={`/icons/domain/${domain}.png`}
          alt={domain}
          title={domain}
          className="size-10 object-contain"
        />
      ))}
    </div>
  )
}

function IconToggleGroup<TValue extends string>({
  label,
  values,
  selectedValues,
  iconPath,
  onToggle,
}: {
  label: string
  values: Array<TValue>
  selectedValues: Array<TValue>
  iconPath: (value: TValue) => string
  onToggle: (value: TValue) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-xl">{label}</span>
      {values.map((value) => {
        const isSelected = selectedValues.includes(value)

        return (
          <button
            key={value}
            type="button"
            aria-pressed={isSelected}
            title={value}
            className={cn(
              "flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-[#222222] transition",
              isSelected
                ? "ring-2 ring-primary"
                : "opacity-75 hover:opacity-100"
            )}
            onClick={() => onToggle(value)}
          >
            <img
              src={iconPath(value)}
              alt={value}
              className="max-h-8 max-w-8 object-contain"
            />
          </button>
        )
      })}
    </div>
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

function CategoryActionMenu({
  open,
  onOpenChange,
  onRename,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRename: () => void
}) {
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current?.contains(event.target as Node)) {
        return
      }

      onOpenChange(false)
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        onOpenChange(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [onOpenChange, open])

  return (
    <div ref={menuRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="text-white hover:bg-white/10"
        onClick={() => onOpenChange(!open)}
      >
        <MoreHorizontal className="size-4" />
      </Button>
      {open ? (
        <div className="absolute top-full right-0 z-30 mt-1 min-w-32 rounded-lg border border-[#3a3a3a] bg-[#111111] p-1 shadow-2xl">
          <button
            type="button"
            className="flex w-full rounded-md px-3 py-2 text-left text-sm text-white transition hover:bg-white/10"
            onClick={onRename}
          >
            Rename
          </button>
        </div>
      ) : null}
    </div>
  )
}

function CardGroup({
  group,
  canDrag,
  draggedCardId,
  placeholderCard,
  isRenaming,
  renameValue,
  renameError,
  isMenuOpen,
  onRenameValueChange,
  onRenameSubmit,
  onRenameCancel,
  onMenuOpenChange,
  onStartRename,
  onChangeQuantity,
  onOpenCardDetails,
}: {
  group: CardGroupModel
  canDrag: boolean
  draggedCardId: string | null
  placeholderCard?: EditableDeckCard
  isRenaming: boolean
  renameValue: string
  renameError: string | null
  isMenuOpen: boolean
  onRenameValueChange: (value: string) => void
  onRenameSubmit: (categoryId: string) => void
  onRenameCancel: () => void
  onMenuOpenChange: (open: boolean) => void
  onStartRename: (categoryId: string) => void
  onChangeQuantity: (cardId: string, delta: number) => void
  onOpenCardDetails: (cardId: string) => void
}) {
  const droppableId = `category:${group.id}`
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    disabled: !canDrag,
  })
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null)
  const hoveredCardIndex = group.cards.findIndex(
    (card) => card.cardId === hoveredCardId
  )
  const isBattlefieldGroup = group.name === "Battlefield"

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
        <div className="min-w-0 flex-1">
          {isRenaming ? (
            <div className="space-y-1">
              <Input
                autoFocus
                value={renameValue}
                maxLength={CATEGORY_NAME_MAX_LENGTH}
                onChange={(event) => onRenameValueChange(event.target.value)}
                onBlur={() => onRenameSubmit(group.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    onRenameSubmit(group.id)
                  }

                  if (event.key === "Escape") {
                    event.preventDefault()
                    onRenameCancel()
                  }
                }}
                className="h-8 border-[#4a4a4a] bg-black px-2 text-sm text-white"
              />
              {renameError ? (
                <p className="text-xs text-destructive">{renameError}</p>
              ) : null}
            </div>
          ) : (
            <h2 className="truncate text-sm font-semibold text-[#dcdcdc]">
              {group.name}
            </h2>
          )}
          <p className="text-xs text-muted-foreground">Qty: {group.quantity}</p>
        </div>
        {canDrag ? (
          <CategoryActionMenu
            open={isMenuOpen}
            onOpenChange={onMenuOpenChange}
            onRename={() => onStartRename(group.id)}
          />
        ) : null}
      </div>

      <div
        className="flex flex-col"
        onMouseLeave={() => setHoveredCardId(null)}
      >
        {group.cards.map((deckCard, index) => (
          <DeckCardTile
            key={deckCard.cardId}
            deckCard={deckCard}
            canDrag={canDrag}
            isDragSource={deckCard.cardId === draggedCardId}
            isHovered={deckCard.cardId === hoveredCardId}
            stackOffset={getStackOffset({
              hoveredCardIndex,
              index,
              isBattlefield: isBattlefieldGroup,
            })}
            onHover={() => setHoveredCardId(deckCard.cardId)}
            onChangeQuantity={onChangeQuantity}
            onOpenCardDetails={onOpenCardDetails}
          />
        ))}
        {placeholderCard ? (
          <DeckCardPlaceholder
            deckCard={placeholderCard}
            stackOffset={group.cards.length === 0 ? 0 : -36}
          />
        ) : null}
      </div>
    </section>
  )
}

function DeckCardTile({
  deckCard,
  canDrag,
  isDragSource,
  isHovered,
  stackOffset,
  onHover,
  onChangeQuantity,
  onOpenCardDetails,
}: {
  deckCard: EditableDeckCard
  canDrag: boolean
  isDragSource: boolean
  isHovered: boolean
  stackOffset: number
  onHover: () => void
  onChangeQuantity: (cardId: string, delta: number) => void
  onOpenCardDetails: (cardId: string) => void
}) {
  const draggable = useDraggable({
    id: `card:${deckCard.cardId}`,
    disabled: !canDrag,
  })
  const style = {
    marginTop: stackOffset,
    zIndex: isHovered ? 100 : undefined,
  }

  return (
    <article
      ref={draggable.setNodeRef}
      style={style}
      {...draggable.attributes}
      {...draggable.listeners}
      onMouseEnter={onHover}
      onClick={() => {
        if (!draggable.isDragging) {
          onOpenCardDetails(deckCard.cardId)
        }
      }}
      className={cn(
        "relative overflow-hidden rounded-md bg-black shadow-lg ring-1 shadow-black/40 ring-white/10 transition-[margin,opacity,box-shadow] duration-150",
        canDrag && "touch-none",
        isDragSource && "opacity-20",
        isHovered && "shadow-2xl ring-primary"
      )}
    >
      <DeckCardVisual deckCard={deckCard} />
      {isHovered ? (
        <div
          className="absolute top-1.5 right-1.5 z-20 flex gap-1"
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="flex size-7 items-center justify-center rounded-full bg-black/85 text-white ring-1 ring-white/30 transition hover:bg-[#202020]"
            aria-label={`Decrease ${deckCard.card.name} count`}
            onClick={() => onChangeQuantity(deckCard.cardId, -1)}
          >
            <Minus className="size-4" />
          </button>
          <button
            type="button"
            className="flex size-7 items-center justify-center rounded-full bg-black/85 text-white ring-1 ring-white/30 transition hover:bg-[#202020]"
            aria-label={`Increase ${deckCard.card.name} count`}
            onClick={() => onChangeQuantity(deckCard.cardId, 1)}
          >
            <Plus className="size-4" />
          </button>
        </div>
      ) : null}
    </article>
  )
}

function DeckCardDragPreview({ deckCard }: { deckCard: EditableDeckCard }) {
  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-md bg-black shadow-2xl ring-2 ring-primary/70",
        deckCard.card.type === "Battlefield" ? "w-[300px]" : "w-[180px]"
      )}
    >
      <DeckCardVisual deckCard={deckCard} />
    </article>
  )
}

function DeckCardPlaceholder({
  deckCard,
  stackOffset = 0,
}: {
  deckCard: EditableDeckCard
  stackOffset?: number
}) {
  return (
    <article
      className="pointer-events-none relative overflow-hidden rounded-md bg-black opacity-35 ring-2 ring-primary/60 transition-[margin] duration-150"
      style={{ marginTop: stackOffset }}
    >
      <DeckCardVisual deckCard={deckCard} />
    </article>
  )
}

function DeckCardVisual({ deckCard }: { deckCard: EditableDeckCard }) {
  const isBattlefield = deckCard.card.type === "Battlefield"

  return (
    <>
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
    </>
  )
}

function getStackOffset({
  hoveredCardIndex,
  index,
  isBattlefield,
}: {
  hoveredCardIndex: number
  index: number
  isBattlefield: boolean
}) {
  if (index === 0) {
    return 0
  }

  if (hoveredCardIndex !== -1 && index > hoveredCardIndex) {
    return 8
  }

  return isBattlefield ? -86 : -214
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

  return groups.map(toGroupQuantity)
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

function flattenFolderNodes(
  folders: Array<DeckFolderNodeDto>,
  depth = 0
): Array<{ id: string; name: string }> {
  return folders.flatMap((folder) => {
    const prefix =
      depth > 0 ? `${"\u00A0\u00A0".repeat(depth)}\u2014\u00A0` : ""
    return [
      { id: folder.id, name: `${prefix}${folder.name}` },
      ...flattenFolderNodes(folder.children, depth + 1),
    ]
  })
}

function DeckSettingsDialog({
  open,
  onOpenChange,
  deck,
  folderOptions,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  deck: DeckDetailDto
  folderOptions: Array<{ id: string; name: string }>
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(deck.name)
  const [description, setDescription] = useState(deck.description ?? "")
  const [visibility, setVisibility] = useState(deck.visibility)
  const [folderId, setFolderId] = useState(deck.folderId)

  useEffect(() => {
    if (!open) return
    setName(deck.name)
    setDescription(deck.description ?? "")
    setVisibility(deck.visibility)
    setFolderId(deck.folderId)
  }, [open, deck])

  const saveMutation = useMutation({
    ...putDecksByDeckIdSettingsMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getDecksByDeckIdQueryKey({ path: { deckId: deck.id } }),
      })
      onOpenChange(false)
    },
  })

  function handleSave() {
    const trimmedName = name.trim()
    if (!trimmedName) return

    saveMutation.mutate({
      path: { deckId: deck.id },
      body: {
        name: trimmedName,
        description: description.trim() || null,
        folderId,
        visibility,
        isArchived: deck.isArchived,
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-[#2f2f2f] bg-[#222222] p-6 text-white">
        <DialogTitle className="text-2xl font-semibold tracking-normal">
          Deck Settings
        </DialogTitle>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="settings-name">Name</Label>
            <Input
              id="settings-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              className="border-[#4a4a4a] bg-black text-white"
            />
            {name.trim().length === 0 ? (
              <p className="text-sm text-destructive">
                Deck name is required
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="settings-description">Description</Label>
            <Textarea
              id="settings-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="border-[#4a4a4a] bg-black text-white"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="settings-visibility">Visibility</Label>
            <Select
              id="settings-visibility"
              value={visibility}
              onChange={(event) =>
                setVisibility(event.target.value as DeckVisibility)
              }
              className="border-[#4a4a4a] bg-black text-white"
            >
              <option value={DeckVisibilityValues.PRIVATE}>Private</option>
              <option value={DeckVisibilityValues.UNLISTED}>Unlisted</option>
              <option value={DeckVisibilityValues.PUBLIC}>Public</option>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="settings-folder">Folder</Label>
            <Select
              id="settings-folder"
              value={folderId ?? ""}
              onChange={(event) => setFolderId(event.target.value || null)}
              className="border-[#4a4a4a] bg-black text-white"
            >
              <option value="">No folder</option>
              {folderOptions.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </Select>
          </div>
          {saveMutation.isError ? (
            <p className="text-sm text-destructive">
              Unable to save settings.
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-[#3a3a3a] bg-black text-white hover:bg-[#161616]"
              onClick={() => onOpenChange(false)}
              disabled={saveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-white text-black hover:bg-[#dddddd]"
              onClick={handleSave}
              disabled={name.trim().length === 0 || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
