import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "@tanstack/react-form"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { ChevronLeft, Folder, FolderPlus, Library, Plus } from "lucide-react"
import { useState } from "react"
import { z } from "zod"
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
import { DeckVisibility } from "@/client"
import {
  getDecksOptions,
  getDecksQueryKey,
  postDecksFoldersMutation,
  postDecksMutation,
} from "@/client/@tanstack/react-query.gen"
import { zCreateDeckFolderRequest, zCreateDeckRequest } from "@/client/zod.gen"
import type {
  CreateDeckFolderRequest,
  CreateDeckRequest,
  DeckFolderNodeDto,
} from "@/client"

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

function DecksRoute() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [isCreateDeckOpen, setIsCreateDeckOpen] = useState(false)
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false)
  const { data, isLoading, isError } = useQuery(getDecksOptions())
  const createDeck = useMutation(postDecksMutation())
  const createFolder = useMutation(postDecksFoldersMutation())
  const allFolders = data?.folders ?? []
  const allFolderOptions = flattenFolders(allFolders)
  const currentFolder = currentFolderId
    ? findFolder(allFolders, currentFolderId)
    : null
  const folders = currentFolder ? currentFolder.children : allFolders
  const decks = currentFolder ? currentFolder.decks : (data?.decks ?? [])
  const hasItems = folders.length > 0 || decks.length > 0
  const currentFolderParentId = currentFolder?.parentFolderId ?? null

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

  return (
    <div className="flex flex-col gap-8">
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
          <button
            type="button"
            key={folder.id}
            onClick={() => setCurrentFolderId(folder.id)}
            className="flex aspect-square flex-col items-center justify-center rounded-lg border bg-card p-4 text-center text-card-foreground transition-colors hover:bg-accent"
          >
            <Folder
              className="mb-4 size-14 text-muted-foreground"
              strokeWidth={1.6}
            />
            <h2 className="line-clamp-2 text-sm font-medium">{folder.name}</h2>
          </button>
        ))}
        {decks.map((deck) => (
          <Link
            key={deck.id}
            to="/decks/$deckId"
            params={{ deckId: deck.id }}
            className="flex aspect-square flex-col items-center justify-center rounded-lg border bg-card p-4 text-center text-card-foreground transition-colors hover:bg-accent"
          >
            <Library
              className="mb-4 size-14 text-muted-foreground"
              strokeWidth={1.6}
            />
            <h2 className="line-clamp-2 text-sm font-medium">{deck.name}</h2>
          </Link>
        ))}
      </div>
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
