import type {
  CardDomain,
  CardSummaryDto,
  DeckLegalityDto,
  DeckLegalityRequirementDto,
} from "@/client/types.gen"
import {
  CardDomain as CardDomainValues,
  CardType as CardTypeValues,
  CardSupertype as CardSupertypeValues,
} from "@/client/types.gen"

type DeckLegalityCard = {
  cardId: string
  quantity: number
  card: Pick<CardSummaryDto, "name" | "type" | "supertype" | "domains">
}

export function evaluateDeckLegality(
  cards: ReadonlyArray<DeckLegalityCard>
): DeckLegalityDto {
  const legalityCards = cards.map(toLegalityCard)
  const legendCards = legalityCards.filter(
    (deckCard) => deckCard.card.type === CardTypeValues.LEGEND
  )
  const legendQuantity = sumQuantities(legendCards)
  const selectedLegend =
    legendCards.length === 1 && legendQuantity === 1 ? legendCards[0] : null

  const mainDeckCards = legalityCards.filter(
    (deckCard) =>
      deckCard.card.type !== CardTypeValues.LEGEND &&
      deckCard.card.type !== CardTypeValues.RUNE &&
      deckCard.card.type !== CardTypeValues.BATTLEFIELD
  )
  const championCount = sumQuantities(
    mainDeckCards.filter(
      (deckCard) =>
        deckCard.card.supertype === CardSupertypeValues.CHAMPION
    )
  )
  const mainDeckCount = sumQuantities(mainDeckCards)

  const runeCount = sumQuantities(
    legalityCards.filter((deckCard) => deckCard.card.type === CardTypeValues.RUNE)
  )

  const battlefieldCards = legalityCards.filter(
    (deckCard) => deckCard.card.type === CardTypeValues.BATTLEFIELD
  )
  const battlefieldCount = sumQuantities(battlefieldCards)
  const distinctBattlefields = new Set(
    battlefieldCards.map((deckCard) => deckCard.card.name)
  ).size

  const requirements: Array<DeckLegalityRequirementDto> = [
    {
      key: "legend",
      label: "Legend selected",
      description: "The deck must contain exactly 1 legend card.",
      isSatisfied: legendCards.length === 1 && legendQuantity === 1,
      failureReason: buildLegendFailureReason(legendCards.length, legendQuantity),
    },
    {
      key: "champion",
      label: "Champion included",
      description: "The 40-card main deck must contain at least 1 champion.",
      isSatisfied: championCount >= 1,
      failureReason:
        championCount >= 1
          ? null
          : "Add at least 1 champion to the main deck.",
    },
    {
      key: "main_deck",
      label: "40-card main deck",
      description:
        "The main deck must contain exactly 40 non-legend, non-rune, non-battlefield cards.",
      isSatisfied: mainDeckCount === 40,
      failureReason:
        mainDeckCount === 40
          ? null
          : `The main deck currently has ${mainDeckCount} of 40 cards.`,
    },
    buildDomainRequirement(legalityCards, selectedLegend),
    {
      key: "runes",
      label: "12-card rune deck",
      description: "The rune deck must contain exactly 12 rune cards.",
      isSatisfied: runeCount === 12,
      failureReason:
        runeCount === 12
          ? null
          : `The rune deck currently has ${runeCount} of 12 cards.`,
    },
    {
      key: "battlefields",
      label: "3 different battlefields",
      description:
        "The deck must contain exactly 3 battlefield cards, all with different names.",
      isSatisfied: battlefieldCount === 3 && distinctBattlefields === 3,
      failureReason: buildBattlefieldFailureReason(
        battlefieldCount,
        distinctBattlefields
      ),
    },
  ]

  return {
    isLegal: requirements.every((requirement) => requirement.isSatisfied),
    requirements,
  }
}

function buildDomainRequirement(
  cards: ReadonlyArray<DeckLegalityCard>,
  selectedLegend: DeckLegalityCard | null
): DeckLegalityRequirementDto {
  if (!selectedLegend) {
    return {
      key: "domains",
      label: "Legend domains only",
      description:
        "All non-battlefield cards must stay within the selected legend's domains. Colorless cards are allowed.",
      isSatisfied: false,
      failureReason:
        "Choose exactly 1 legend before domain legality can be satisfied.",
    }
  }

  const allowedDomains = new Set(
    selectedLegend.card.domains.filter(
      (domain) => domain !== CardDomainValues.COLORLESS
    )
  )
  const invalidCards = cards
    .map((deckCard) => ({
      deckCard,
      invalidDomains: deckCard.card.domains.filter(
        (domain) =>
          domain !== CardDomainValues.COLORLESS && !allowedDomains.has(domain)
      ),
    }))
    .filter(
      (entry) =>
        entry.deckCard.card.type !== CardTypeValues.LEGEND &&
        entry.deckCard.card.type !== CardTypeValues.BATTLEFIELD &&
        entry.invalidDomains.length > 0
    )

  return {
    key: "domains",
    label: "Legend domains only",
    description:
      "All non-battlefield cards must stay within the selected legend's domains. Colorless cards are allowed.",
    isSatisfied: invalidCards.length === 0,
    failureReason:
      invalidCards.length === 0
        ? null
        : buildDomainFailureReason(selectedLegend, invalidCards),
  }
}

function buildLegendFailureReason(
  distinctLegendCards: number,
  legendQuantity: number
) {
  if (legendQuantity === 0) {
    return "Add exactly 1 legend card."
  }

  if (distinctLegendCards === 1 && legendQuantity > 1) {
    return "Reduce the legend count to exactly 1 copy."
  }

  return `The deck currently has ${legendQuantity} legend cards. It needs exactly 1.`
}

function buildBattlefieldFailureReason(
  battlefieldCount: number,
  distinctBattlefields: number
) {
  if (battlefieldCount === 3 && distinctBattlefields === 3) {
    return null
  }

  if (battlefieldCount === 3 && distinctBattlefields < 3) {
    return "Each battlefield must be a different card."
  }

  return `The deck currently has ${battlefieldCount} battlefield cards across ${distinctBattlefields} different battlefields.`
}

function buildDomainFailureReason(
  selectedLegend: DeckLegalityCard,
  invalidCards: Array<{
    deckCard: DeckLegalityCard
    invalidDomains: Array<CardDomain>
  }>
) {
  const allowedDomains = selectedLegend.card.domains.filter(
    (domain) => domain !== CardDomainValues.COLORLESS
  )
  const invalidCardLabel = invalidCards
    .slice(0, 3)
    .map(
      ({ deckCard, invalidDomains }) =>
        `${deckCard.card.name} (${invalidDomains.join(", ")})`
    )
    .join("; ")
  const extraCount =
    invalidCards.length > 3 ? ` and ${invalidCards.length - 3} more` : ""

  return `Allowed domains: ${allowedDomains.join(", ") || "none"}. Cards outside those domains: ${invalidCardLabel}${extraCount}.`
}

function toLegalityCard(card: DeckLegalityCard): DeckLegalityCard {
  return {
    cardId: card.cardId,
    quantity: card.quantity,
    card: card.card,
  }
}

function sumQuantities(cards: ReadonlyArray<{ quantity: number }>) {
  return cards.reduce((total, deckCard) => total + deckCard.quantity, 0)
}
