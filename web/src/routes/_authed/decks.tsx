import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "@tanstack/react-form"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  ChevronLeft,
  Folder,
  FolderPlus,
  Library,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import { useRef, useState } from "react"
import type { PointerEvent as ReactPointerEvent } from "react"
import { z } from "zod"
// eslint-disable-next-line import/consistent-type-specifier-style
import {
  type CreateDeckFolderRequest,
  type CreateDeckRequest,
  type DeckFolderNodeDto,
  type DeckListItemDto,
  DeckVisibility,
} from "@/client"
import {
  deleteDecksByDeckIdMutation,
  deleteDecksFoldersByFolderIdMutation,
  getDecksOptions,
  getDecksQueryKey,
  postDecksFoldersMutation,
  postDecksMutation,
  putDecksByDeckIdSettingsMutation,
  putDecksFoldersByFolderIdMutation,
} from "@/client/@tanstack/react-query.gen"
import {
  zCreateDeckFolderRequest,
  zCreateDeckRequest,
  zUpdateDeckFolderRequest,
  zUpdateDeckSettingsRequest,
} from "@/client/zod.gen"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

export const Route = createFileRoute("/_authed/decks")({
  component: DecksRoute,
})

const createDeckDefaults: CreateDeckRequest = {
  name: "",
  description: null,
  folderId: null,
  visibility: DeckVisibility.PRIVATE,
}

const createDeckFormSchema = zCreateDeckRequest.extend({
  name: z.string().trim().min(1, "Deck name is required"),
})

const createFolderFormSchema = zCreateDeckFolderRequest.extend({
  name: z.string().trim().min(1, "Folder name is required"),
})

const editFolderFormSchema = zUpdateDeckFolderRequest.extend({
  name: z.string().trim().min(1, "Folder name is required"),
})

const editDeckFormSchema = zUpdateDeckSettingsRequest.extend({
  name: z.string().trim().min(1, "Deck name is required"),
})

const LONG_PRESS_DELAY_MS = 500
const LONG_PRESS_MOVE_THRESHOLD_PX = 10

type ContextMenuTarget =
  | { kind: "folder"; item: DeckFolderNodeDto }
  | { kind: "deck"; item: DeckListItemDto }

function DecksRoute() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [isCreateDeckOpen, setIsCreateDeckOpen] = useState(false)
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [contextMenuTarget, setContextMenuTarget] =
    useState<ContextMenuTarget | null>(null)
  const [editingFolder, setEditingFolder] = useState<DeckFolderNodeDto | null>(
    null
  )
  const [editingDeck, setEditingDeck] = useState<DeckListItemDto | null>(null)
  const [editFolderName, setEditFolderName] = useState("")
  const [editFolderParentId, setEditFolderParentId] = useState<string | null>(
    null
  )
  const [editFolderSortOrder, setEditFolderSortOrder] = useState(0)
  const [editDeckName, setEditDeckName] = useState("")
  const [editDeckFolderId, setEditDeckFolderId] = useState<string | null>(null)
  const [deletingFolder, setDeletingFolder] =
    useState<DeckFolderNodeDto | null>(null)
  const [deletingDeck, setDeletingDeck] = useState<DeckListItemDto | null>(null)
  const { data, isLoading, isError } = useQuery(getDecksOptions())
  const createDeck = useMutation(postDecksMutation())
  const createFolder = useMutation(postDecksFoldersMutation())
  const editFolder = useMutation(putDecksFoldersByFolderIdMutation())
  const editDeck = useMutation(putDecksByDeckIdSettingsMutation())
  const deleteFolder = useMutation(deleteDecksFoldersByFolderIdMutation())
  const deleteDeck = useMutation(deleteDecksByDeckIdMutation())
  const allFolders = data?.folders ?? []
  const allFolderOptions = flattenFolders(allFolders)
  const currentFolder = currentFolderId
    ? findFolder(allFolders, currentFolderId)
    : null
  const folders = currentFolder ? currentFolder.children : allFolders
  const decks = currentFolder ? currentFolder.decks : (data?.decks ?? [])
  const hasItems = folders.length > 0 || decks.length > 0
  const currentFolderParentId = currentFolder?.parentFolderId ?? null
  const longPressTimerRef = useRef<number | null>(null)
  const longPressPointerIdRef = useRef<number | null>(null)
  const longPressStartRef = useRef({ x: 0, y: 0 })
  const suppressClickUntilRef = useRef(0)

  function getCreateDeckDefaults(): CreateDeckRequest {
    return {
      ...createDeckDefaults,
      folderId: currentFolder?.id ?? null,
    }
  }

  function getCreateFolderDefaults(): CreateDeckFolderRequest {
    return {
      name: "",
      parentFolderId: currentFolder?.id ?? null,
      sortOrder: folders.length,
    }
  }

  const deckForm = useForm({
    defaultValues: getCreateDeckDefaults(),
    validators: {
      onSubmit: ({ value }) => {
        const result = createDeckFormSchema.safeParse(value)

        if (result.success) {
          return undefined
        }

        return {
          fields: Object.fromEntries(
            result.error.issues.map((issue) => [
              issue.path.join("."),
              issue.message,
            ])
          ),
        }
      },
    },
    onSubmit: async ({ value, formApi }) => {
      const deck = await createDeck.mutateAsync({
        body: createDeckFormSchema.parse(value),
      })
      await queryClient.invalidateQueries({ queryKey: getDecksQueryKey() })
      formApi.reset(getCreateDeckDefaults())
      setIsCreateDeckOpen(false)
      await navigate({ to: "/decks/$deckId", params: { deckId: deck.id } })
    },
  })

  const folderForm = useForm({
    defaultValues: getCreateFolderDefaults(),
    validators: {
      onSubmit: ({ value }) => {
        const result = createFolderFormSchema.safeParse(value)

        if (result.success) {
          return undefined
        }

        return {
          fields: Object.fromEntries(
            result.error.issues.map((issue) => [
              issue.path.join("."),
              issue.message,
            ])
          ),
        }
      },
    },
    onSubmit: async ({ value, formApi }) => {
      await createFolder.mutateAsync({
        body: createFolderFormSchema.parse(value),
      })
      await queryClient.invalidateQueries({ queryKey: getDecksQueryKey() })
      formApi.reset(getCreateFolderDefaults())
      setIsCreateFolderOpen(false)
    },
  })

  function handleEditFolder(folder: DeckFolderNodeDto) {
    setOpenMenuId(null)
    setContextMenuTarget(null)
    setEditFolderName(folder.name)
    setEditFolderParentId(folder.parentFolderId)
    setEditFolderSortOrder(folder.sortOrder)
    editFolder.reset()
    setEditingFolder(folder)
  }

  function handleEditDeck(deck: DeckListItemDto) {
    setOpenMenuId(null)
    setContextMenuTarget(null)
    setEditDeckName(deck.name)
    setEditDeckFolderId(deck.folderId)
    editDeck.reset()
    setEditingDeck(deck)
  }

  function handleSubmitEditFolder() {
    if (!editingFolder || editFolder.isPending) {
      return
    }

    const parsed = editFolderFormSchema.safeParse({
      name: editFolderName,
      parentFolderId: editFolderParentId,
      sortOrder: editFolderSortOrder,
    })

    if (!parsed.success) {
      return
    }

    editFolder
      .mutateAsync({
        path: { folderId: editingFolder.id },
        body: parsed.data,
      })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: getDecksQueryKey() })
        setEditingFolder(null)
      })
  }

  function handleSubmitEditDeck() {
    if (!editingDeck || editDeck.isPending) {
      return
    }

    const parsed = editDeckFormSchema.safeParse({
      name: editDeckName,
      description: editingDeck.description,
      folderId: editDeckFolderId,
      visibility: editingDeck.visibility,
      isArchived: editingDeck.isArchived,
    })

    if (!parsed.success) {
      return
    }

    editDeck
      .mutateAsync({
        path: { deckId: editingDeck.id },
        body: parsed.data,
      })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: getDecksQueryKey() })
        setEditingDeck(null)
      })
  }

  function resetEditFolderState() {
    setEditingFolder(null)
    setEditFolderName("")
    setEditFolderParentId(null)
    setEditFolderSortOrder(0)
    editFolder.reset()
  }

  function resetEditDeckState() {
    setEditingDeck(null)
    setEditDeckName("")
    setEditDeckFolderId(null)
    editDeck.reset()
  }

  function handleDeleteFolder(folder: DeckFolderNodeDto) {
    setOpenMenuId(null)
    setContextMenuTarget(null)
    deleteFolder.reset()
    setDeletingFolder(folder)
  }

  function handleDeleteDeck(deck: DeckListItemDto) {
    setOpenMenuId(null)
    setContextMenuTarget(null)
    deleteDeck.reset()
    setDeletingDeck(deck)
  }

  function clearLongPressState() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }

    longPressPointerIdRef.current = null
  }

  function openContextMenu(target: ContextMenuTarget) {
    clearLongPressState()
    setOpenMenuId(null)
    setContextMenuTarget(target)
  }

  function closeContextMenu() {
    setContextMenuTarget(null)
  }

  function startLongPress(
    event: ReactPointerEvent<HTMLElement>,
    target: ContextMenuTarget
  ) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return
    }

    clearLongPressState()
    longPressPointerIdRef.current = event.pointerId
    longPressStartRef.current = { x: event.clientX, y: event.clientY }
    longPressTimerRef.current = window.setTimeout(() => {
      suppressClickUntilRef.current = performance.now() + 750
      openContextMenu(target)
    }, LONG_PRESS_DELAY_MS)
  }

  function handleLongPressMove(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerId !== longPressPointerIdRef.current) {
      return
    }

    const deltaX = event.clientX - longPressStartRef.current.x
    const deltaY = event.clientY - longPressStartRef.current.y
    if (Math.hypot(deltaX, deltaY) > LONG_PRESS_MOVE_THRESHOLD_PX) {
      clearLongPressState()
    }
  }

  function endLongPress(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerId !== longPressPointerIdRef.current) {
      return
    }

    clearLongPressState()
  }

  function shouldSuppressClick(timeStamp: number) {
    return timeStamp <= suppressClickUntilRef.current
  }

  function getFolderMenuId(folderId: string) {
    return `folder-${folderId}`
  }

  function getDeckMenuId(deckId: string) {
    return `deck-${deckId}`
  }

  return (
    <div className="mt-8 flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <section className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-normal">Decks</h1>
          <p className="text-sm text-muted-foreground">
            {currentFolder ? currentFolder.name : "Your RiftBench decks."}
          </p>
        </section>
        <div className="flex items-center gap-2">
          <Dialog
            open={isCreateFolderOpen}
            onOpenChange={(open) => {
              if (createFolder.isPending) {
                return
              }

              setIsCreateFolderOpen(open)

              if (open) {
                folderForm.reset(getCreateFolderDefaults())
                createFolder.reset()
              }
            }}
          >
            <Button
              variant="outline"
              onClick={() => setIsCreateFolderOpen(true)}
            >
              <FolderPlus data-icon="inline-start" />
              New folder
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New folder</DialogTitle>
                <DialogDescription>
                  Create a folder in{" "}
                  {currentFolder ? currentFolder.name : "your library"}.
                </DialogDescription>
              </DialogHeader>
              <form
                className="grid gap-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  void folderForm.handleSubmit()
                }}
              >
                <folderForm.Field name="name">
                  {(field) => (
                    <div className="grid gap-2">
                      <Label htmlFor={field.name}>Name</Label>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        aria-invalid={field.state.meta.errors.length > 0}
                        autoFocus
                      />
                      <FieldError errors={field.state.meta.errors} />
                    </div>
                  )}
                </folderForm.Field>

                {createFolder.isError ? (
                  <p className="text-sm text-destructive">
                    Unable to create a new folder.
                  </p>
                ) : null}

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateFolderOpen(false)}
                    disabled={createFolder.isPending}
                  >
                    Cancel
                  </Button>
                  <folderForm.Subscribe
                    selector={(state) => [state.canSubmit, state.isSubmitting]}
                  >
                    {([canSubmit, isSubmitting]) => (
                      <Button
                        type="submit"
                        disabled={
                          !canSubmit || isSubmitting || createFolder.isPending
                        }
                      >
                        {createFolder.isPending
                          ? "Creating..."
                          : "Create folder"}
                      </Button>
                    )}
                  </folderForm.Subscribe>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog
            open={isCreateDeckOpen}
            onOpenChange={(open) => {
              if (createDeck.isPending) {
                return
              }

              setIsCreateDeckOpen(open)

              if (open) {
                deckForm.reset(getCreateDeckDefaults())
                createDeck.reset()
              }
            }}
          >
            <Button onClick={() => setIsCreateDeckOpen(true)}>
              <Plus data-icon="inline-start" />
              New deck
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New deck</DialogTitle>
                <DialogDescription>
                  Create a deck in your library.
                </DialogDescription>
              </DialogHeader>
              <form
                className="grid gap-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  void deckForm.handleSubmit()
                }}
              >
                <deckForm.Field name="name">
                  {(field) => (
                    <div className="grid gap-2">
                      <Label htmlFor={field.name}>Name</Label>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        aria-invalid={field.state.meta.errors.length > 0}
                        autoFocus
                      />
                      <FieldError errors={field.state.meta.errors} />
                    </div>
                  )}
                </deckForm.Field>

                <deckForm.Field name="description">
                  {(field) => (
                    <div className="grid gap-2">
                      <Label htmlFor={field.name}>Description</Label>
                      <Textarea
                        id={field.name}
                        name={field.name}
                        value={field.state.value ?? ""}
                        onBlur={field.handleBlur}
                        onChange={(event) => {
                          field.handleChange(
                            event.target.value.trim() === ""
                              ? null
                              : event.target.value
                          )
                        }}
                        aria-invalid={field.state.meta.errors.length > 0}
                      />
                      <FieldError errors={field.state.meta.errors} />
                    </div>
                  )}
                </deckForm.Field>

                <deckForm.Field name="folderId">
                  {(field) => (
                    <div className="grid gap-2">
                      <Label htmlFor={field.name}>Folder</Label>
                      <Select
                        id={field.name}
                        name={field.name}
                        value={field.state.value ?? ""}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value || null)
                        }
                        aria-invalid={field.state.meta.errors.length > 0}
                      >
                        <option value="">No folder</option>
                        {allFolderOptions.map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            {folder.name}
                          </option>
                        ))}
                      </Select>
                      <FieldError errors={field.state.meta.errors} />
                    </div>
                  )}
                </deckForm.Field>

                <deckForm.Field name="visibility">
                  {(field) => (
                    <div className="grid gap-2">
                      <Label htmlFor={field.name}>Visibility</Label>
                      <Select
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(
                            event.target.value as DeckVisibility
                          )
                        }
                        aria-invalid={field.state.meta.errors.length > 0}
                      >
                        <option value={DeckVisibility.PRIVATE}>Private</option>
                        <option value={DeckVisibility.UNLISTED}>
                          Unlisted
                        </option>
                        <option value={DeckVisibility.PUBLIC}>Public</option>
                      </Select>
                      <FieldError errors={field.state.meta.errors} />
                    </div>
                  )}
                </deckForm.Field>

                {createDeck.isError ? (
                  <p className="text-sm text-destructive">
                    Unable to create a new deck.
                  </p>
                ) : null}

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDeckOpen(false)}
                    disabled={createDeck.isPending}
                  >
                    Cancel
                  </Button>
                  <deckForm.Subscribe
                    selector={(state) => [state.canSubmit, state.isSubmitting]}
                  >
                    {([canSubmit, isSubmitting]) => (
                      <Button
                        type="submit"
                        disabled={
                          !canSubmit || isSubmitting || createDeck.isPending
                        }
                      >
                        {createDeck.isPending ? "Creating..." : "Create deck"}
                      </Button>
                    )}
                  </deckForm.Subscribe>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading your decks...</p>
      ) : null}
      {isError ? (
        <p className="text-sm text-destructive">Unable to load your decks.</p>
      ) : null}

      {!hasItems && !isLoading ? (
        <p className="text-sm text-muted-foreground">No decks found.</p>
      ) : null}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {currentFolder ? (
          <button
            type="button"
            onClick={() => setCurrentFolderId(currentFolderParentId)}
            className="flex aspect-square flex-col items-center justify-center rounded-lg border bg-card p-4 text-center text-card-foreground transition-colors hover:bg-accent"
          >
            <ChevronLeft
              className="mb-4 size-14 text-muted-foreground"
              strokeWidth={1.6}
            />
            <h2 className="line-clamp-2 text-sm font-medium">Back</h2>
          </button>
        ) : null}
        {folders.map((folder) => (
          <div key={folder.id} className="group relative">
            <button
              type="button"
              onPointerDown={(event) =>
                startLongPress(event, { kind: "folder", item: folder })
              }
              onPointerMove={handleLongPressMove}
              onPointerUp={endLongPress}
              onPointerCancel={endLongPress}
              onPointerLeave={endLongPress}
              onContextMenu={(event) => {
                event.preventDefault()
                openContextMenu({ kind: "folder", item: folder })
              }}
              onClick={(event) => {
                if (shouldSuppressClick(event.timeStamp)) {
                  event.preventDefault()
                  return
                }

                setCurrentFolderId(folder.id)
              }}
              className="flex aspect-square w-full flex-col items-center justify-center rounded-lg border bg-card p-4 text-center text-card-foreground transition-colors hover:bg-accent"
            >
              <Folder
                className="mb-4 size-14 text-muted-foreground"
                strokeWidth={1.6}
              />
              <h2 className="line-clamp-2 text-sm font-medium">
                {folder.name}
              </h2>
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setOpenMenuId(
                  openMenuId === getFolderMenuId(folder.id)
                    ? null
                    : getFolderMenuId(folder.id)
                )
                setContextMenuTarget(null)
              }}
              className="absolute top-2 right-2 z-10 rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent"
              aria-label="Folder actions"
            >
              <MoreHorizontal className="size-4" />
            </button>
            {openMenuId === getFolderMenuId(folder.id) ? (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setOpenMenuId(null)}
                />
                <div className="absolute top-10 right-2 z-40 w-32 overflow-hidden rounded-md border bg-popover p-1 shadow-md">
                  <button
                    type="button"
                    onClick={() => handleEditFolder(folder)}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <Pencil className="size-3.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteFolder(folder)}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
                  >
                    <Trash2 className="size-3.5" />
                    Delete
                  </button>
                </div>
              </>
            ) : null}
          </div>
        ))}
        {decks.map((deck) => (
          <div key={deck.id} className="group relative">
            <Link
              to="/decks/$deckId"
              params={{ deckId: deck.id }}
              onPointerDown={(event) =>
                startLongPress(event, { kind: "deck", item: deck })
              }
              onPointerMove={handleLongPressMove}
              onPointerUp={endLongPress}
              onPointerCancel={endLongPress}
              onPointerLeave={endLongPress}
              onContextMenu={(event) => {
                event.preventDefault()
                openContextMenu({ kind: "deck", item: deck })
              }}
              onClick={(event) => {
                if (shouldSuppressClick(event.timeStamp)) {
                  event.preventDefault()
                  event.stopPropagation()
                }
              }}
              className="flex aspect-square w-full flex-col items-center justify-center rounded-lg border bg-card p-4 text-center text-card-foreground transition-colors hover:bg-accent"
            >
              <Library
                className="mb-4 size-14 text-muted-foreground"
                strokeWidth={1.6}
              />
              <h2 className="line-clamp-2 text-sm font-medium">{deck.name}</h2>
            </Link>
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                setOpenMenuId(
                  openMenuId === getDeckMenuId(deck.id)
                    ? null
                    : getDeckMenuId(deck.id)
                )
                setContextMenuTarget(null)
              }}
              className="absolute top-2 right-2 z-10 rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent"
              aria-label="Deck actions"
            >
              <MoreHorizontal className="size-4" />
            </button>
            {openMenuId === getDeckMenuId(deck.id) ? (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setOpenMenuId(null)}
                />
                <div className="absolute top-10 right-2 z-40 w-32 overflow-hidden rounded-md border bg-popover p-1 shadow-md">
                  <button
                    type="button"
                    onClick={() => handleEditDeck(deck)}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <Pencil className="size-3.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteDeck(deck)}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
                  >
                    <Trash2 className="size-3.5" />
                    Delete
                  </button>
                </div>
              </>
            ) : null}
          </div>
        ))}
      </div>

      <Dialog
        open={contextMenuTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeContextMenu()
          }
        }}
      >
        <DialogContent className="top-auto bottom-0 left-1/2 w-[calc(100%-1rem)] max-w-xl -translate-x-1/2 translate-y-0 rounded-t-3xl rounded-b-none border-[#2f2f2f] bg-[#222222] p-0 text-white sm:bottom-4 sm:rounded-3xl">
          <div className="mx-auto mt-3 h-1.5 w-14 rounded-full bg-white/20 sm:hidden" />
          <div className="p-6">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="truncate text-xl font-semibold">
                {contextMenuTarget?.item.name}
              </DialogTitle>
              <DialogDescription className="text-white/60">
                {contextMenuTarget?.kind === "folder" ? "Folder" : "Deck"}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 grid gap-2">
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left text-base transition hover:bg-white/5"
                onClick={() => {
                  if (!contextMenuTarget) {
                    return
                  }

                  if (contextMenuTarget.kind === "folder") {
                    handleEditFolder(contextMenuTarget.item)
                    return
                  }

                  handleEditDeck(contextMenuTarget.item)
                }}
              >
                <Pencil className="size-4" />
                Edit
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left text-base text-destructive transition hover:bg-white/5"
                onClick={() => {
                  if (!contextMenuTarget) {
                    return
                  }

                  if (contextMenuTarget.kind === "folder") {
                    handleDeleteFolder(contextMenuTarget.item)
                    return
                  }

                  handleDeleteDeck(contextMenuTarget.item)
                }}
              >
                <Trash2 className="size-4" />
                Delete
              </button>
              <button
                type="button"
                className="mt-2 rounded-2xl border border-white/10 px-4 py-3 text-base transition hover:bg-white/5"
                onClick={closeContextMenu}
              >
                Cancel
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editingFolder !== null}
        onOpenChange={(open) => {
          if (editFolder.isPending) {
            return
          }

          if (!open) {
            resetEditFolderState()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit folder</DialogTitle>
            <DialogDescription>Rename or move this folder.</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              event.stopPropagation()
              handleSubmitEditFolder()
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="edit-folder-name">Name</Label>
              <Input
                id="edit-folder-name"
                value={editFolderName}
                onChange={(event) => setEditFolderName(event.target.value)}
                autoFocus
              />
              {editFolderName.trim().length === 0 ? (
                <p className="text-sm text-destructive">
                  Folder name is required
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-folder-parent">Parent folder</Label>
              <Select
                id="edit-folder-parent"
                value={editFolderParentId ?? ""}
                onChange={(event) =>
                  setEditFolderParentId(event.target.value || null)
                }
              >
                <option value="">None (root level)</option>
                {flattenFolderSelectOptions(
                  allFolders,
                  editingFolder ? getDescendantIds(editingFolder) : undefined
                ).map((folderOption) => (
                  <option key={folderOption.id} value={folderOption.id}>
                    {folderOption.name}
                  </option>
                ))}
              </Select>
            </div>
            {editFolder.isError ? (
              <p className="text-sm text-destructive">
                Unable to update folder.
              </p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={resetEditFolderState}
                disabled={editFolder.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  editFolderName.trim().length === 0 || editFolder.isPending
                }
              >
                {editFolder.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editingDeck !== null}
        onOpenChange={(open) => {
          if (editDeck.isPending) {
            return
          }

          if (!open) {
            resetEditDeckState()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit deck</DialogTitle>
            <DialogDescription>Rename or move this deck.</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              event.stopPropagation()
              handleSubmitEditDeck()
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="edit-deck-name">Name</Label>
              <Input
                id="edit-deck-name"
                value={editDeckName}
                onChange={(event) => setEditDeckName(event.target.value)}
                autoFocus
              />
              {editDeckName.trim().length === 0 ? (
                <p className="text-sm text-destructive">
                  Deck name is required
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-deck-folder">Folder</Label>
              <Select
                id="edit-deck-folder"
                value={editDeckFolderId ?? ""}
                onChange={(event) =>
                  setEditDeckFolderId(event.target.value || null)
                }
              >
                <option value="">No folder</option>
                {allFolderOptions.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </Select>
            </div>
            {editDeck.isError ? (
              <p className="text-sm text-destructive">Unable to update deck.</p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={resetEditDeckState}
                disabled={editDeck.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  editDeckName.trim().length === 0 || editDeck.isPending
                }
              >
                {editDeck.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deletingFolder !== null}
        onOpenChange={(open) => {
          if (deleteFolder.isPending) {
            return
          }

          if (!open) {
            setDeletingFolder(null)
            deleteFolder.reset()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete folder</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingFolder?.name}"? This
              folder must be empty.
            </DialogDescription>
          </DialogHeader>
          {deleteFolder.isError ? (
            <p className="text-sm text-destructive">
              Folder must be empty before it can be deleted.
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeletingFolder(null)
                deleteFolder.reset()
              }}
              disabled={deleteFolder.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteFolder.isPending}
              onClick={async () => {
                if (!deletingFolder) {
                  return
                }

                await deleteFolder.mutateAsync({
                  path: { folderId: deletingFolder.id },
                })
                await queryClient.invalidateQueries({
                  queryKey: getDecksQueryKey(),
                })

                if (currentFolderId === deletingFolder.id) {
                  setCurrentFolderId(deletingFolder.parentFolderId)
                }

                setDeletingFolder(null)
              }}
            >
              {deleteFolder.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deletingDeck !== null}
        onOpenChange={(open) => {
          if (deleteDeck.isPending) {
            return
          }

          if (!open) {
            setDeletingDeck(null)
            deleteDeck.reset()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete deck</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingDeck?.name}"? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteDeck.isError ? (
            <p className="text-sm text-destructive">Unable to delete deck.</p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeletingDeck(null)
                deleteDeck.reset()
              }}
              disabled={deleteDeck.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteDeck.isPending}
              onClick={async () => {
                if (!deletingDeck) {
                  return
                }

                await deleteDeck.mutateAsync({
                  path: { deckId: deletingDeck.id },
                })
                await queryClient.invalidateQueries({
                  queryKey: getDecksQueryKey(),
                })
                setDeletingDeck(null)
              }}
            >
              {deleteDeck.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FieldError({ errors }: { errors: Array<unknown> }) {
  if (errors.length === 0) {
    return null
  }

  return <p className="text-sm text-destructive">{String(errors[0])}</p>
}

function flattenFolders(
  folders: Array<DeckFolderNodeDto>
): Array<DeckFolderNodeDto> {
  return folders.flatMap((folder) => [
    folder,
    ...flattenFolders(folder.children),
  ])
}

function getDescendantIds(folder: DeckFolderNodeDto): Set<string> {
  const ids = new Set<string>([folder.id])
  for (const child of folder.children) {
    for (const id of getDescendantIds(child)) {
      ids.add(id)
    }
  }
  return ids
}

function flattenFolderSelectOptions(
  folders: Array<DeckFolderNodeDto>,
  excludeIds?: Set<string>,
  depth = 0
): Array<{ id: string; name: string }> {
  return folders.flatMap((folder) => {
    if (excludeIds?.has(folder.id)) {
      return []
    }

    const prefix =
      depth > 0 ? `${"\u00A0\u00A0".repeat(depth)}\u2014\u00A0` : ""
    return [
      { id: folder.id, name: `${prefix}${folder.name}` },
      ...flattenFolderSelectOptions(folder.children, excludeIds, depth + 1),
    ]
  })
}

function findFolder(
  folders: Array<DeckFolderNodeDto>,
  folderId: string
): DeckFolderNodeDto | null {
  for (const folder of folders) {
    if (folder.id === folderId) {
      return folder
    }

    const child = findFolder(folder.children, folderId)

    if (child) {
      return child
    }
  }

  return null
}
