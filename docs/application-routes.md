# Application Routes

## Web Routes

### Public Routes

- `/`
  - landing page
- `/browse`
  - public deck browser
- `/login`
  - provider selection page
- `/auth`
  - post-OAuth callback handoff page
- `/decks/$deckId`
  - deck detail page
  - editable only for the owner

### Authenticated Route Group

- `/_authed`
  - pathless guard route
  - ensures current user is loaded before child routes render
- `/decks`
  - current user deck library

## API Routes

### Auth

- `GET /auth/login/github`
- `GET /auth/login/discord`
- `GET|POST /auth/callback/{provider}`
- `POST /auth/exchange`
- `POST /auth/logout`
- `GET /me`
- `POST /auth/refresh`

### Cards

- `GET /cards`
  - search, filter, sort, and paginate cards
- `GET /cards/{cardId}`
  - card detail

### Decks and Folders

- `GET /decks/browse`
  - public deck browse list
- `GET /users/{userId}/decks`
  - public deck tree for one user
- `GET /decks`
  - current user deck tree
- `GET /decks/{deckId}`
  - deck detail with access checks
- `POST /decks`
  - create deck
- `PUT /decks/{deckId}/settings`
  - update deck metadata
- `PUT /decks/{deckId}/cards`
  - replace deck categories and cards
- `DELETE /decks/{deckId}`
  - delete deck
- `POST /decks/folders`
  - create folder
- `PUT /decks/folders/{folderId}`
  - update folder
- `DELETE /decks/folders/{folderId}`
  - delete folder
