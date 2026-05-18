# Database Entities

## Core Relationships

```mermaid
erDiagram
    ApplicationUser ||--o{ DeckFolder : owns
    ApplicationUser ||--o{ Deck : owns
    DeckFolder ||--o{ DeckFolder : contains
    DeckFolder ||--o{ Deck : contains
    Deck ||--o{ DeckCategory : groups
    Deck ||--o{ DeckCard : contains
    DeckCategory ||--o{ DeckCard : categorizes
    CardSet ||--o{ Card : contains
    Card ||--o{ CardDomainValue : tagged_with
    Card ||--o{ DeckCard : referenced_by

    ApplicationUser {
        guid Id
        string UserName
        string Email
    }

    DeckFolder {
        guid Id
        guid UserId
        guid ParentFolderId
        string Name
        int SortOrder
        datetime CreatedAt
        datetime UpdatedAt
    }

    Deck {
        guid Id
        guid UserId
        guid FolderId
        string Name
        string Description
        string Visibility
        bool IsArchived
        datetime CreatedAt
        datetime UpdatedAt
    }

    DeckCategory {
        guid Id
        guid DeckId
        string Name
        int SortOrder
        datetime CreatedAt
    }

    DeckCard {
        guid DeckId
        guid CardId
        guid CategoryId
        int Quantity
        int SortOrder
        string Notes
    }

    CardSet {
        guid Id
        string RiftCodexId
        string SetId
        string Name
        int CardCount
        datetime PublishedOn
    }

    Card {
        guid Id
        string RiftCodexId
        string RiftboundId
        string RiftboundIdNormalized
        guid CardSetId
        string SetCode
        string SetLabel
        string Name
        string CleanName
        int CollectorNumber
        string Type
        string Supertype
        string Rarity
        int Energy
        int Might
        int Power
    }

    CardDomainValue {
        guid CardId
        string Domain
    }
```

## Entity Notes

### Identity and Ownership

- `ApplicationUser`
  - standard ASP.NET Core Identity user
  - owns all folders and decks

### Deck Library

- `DeckFolder`
  - user-owned hierarchical folder tree
  - parent folder is optional
- `Deck`
  - belongs to a user
  - optionally belongs to a folder
  - visibility is `Private`, `Unlisted`, or `Public`
  - can be archived without being deleted
- `DeckCategory`
  - custom grouping buckets inside one deck
- `DeckCard`
  - join entity between a deck and a card
  - stores quantity, category assignment, sort order, and optional notes

### Card Catalog

- `CardSet`
  - imported set metadata
- `Card`
  - imported card record with search and display fields
- `CardDomainValue`
  - many-to-one domain tags for cards
