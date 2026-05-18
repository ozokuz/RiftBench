using RiftBench.API.Models.Decks;
using RiftBench.Data.Entities.Cards;

namespace RiftBench.API.Services;

internal static class DeckLegalityEvaluator
{
    private const string LegendRequirementKey = "legend";
    private const string ChampionRequirementKey = "champion";
    private const string MainDeckRequirementKey = "main_deck";
    private const string DomainRequirementKey = "domains";
    private const string RuneRequirementKey = "runes";
    private const string BattlefieldRequirementKey = "battlefields";

    public static DeckLegalityDto Evaluate(IReadOnlyList<DeckLegalityCard> cards)
    {
        var legendCards = cards
            .Where(card => card.Type == CardType.Legend)
            .ToList();
        var legendQuantity = legendCards.Sum(card => card.Quantity);
        var selectedLegend = legendCards.Count == 1 && legendQuantity == 1
            ? legendCards[0]
            : null;

        var mainDeckCards = cards
            .Where(card => card.Type is not CardType.Legend and not CardType.Rune and not CardType.Battlefield)
            .ToList();
        var championCount = mainDeckCards
            .Where(card => card.Supertype == CardSupertype.Champion)
            .Sum(card => card.Quantity);
        var mainDeckCount = mainDeckCards.Sum(card => card.Quantity);

        var runeCount = cards
            .Where(card => card.Type == CardType.Rune)
            .Sum(card => card.Quantity);

        var battlefieldCards = cards
            .Where(card => card.Type == CardType.Battlefield)
            .ToList();
        var battlefieldCount = battlefieldCards.Sum(card => card.Quantity);
        var distinctBattlefields = battlefieldCards
            .Select(card => card.Name)
            .Distinct()
            .Count();

        var requirements = new List<DeckLegalityRequirementDto>
        {
            new(
                LegendRequirementKey,
                "Legend selected",
                "The deck must contain exactly 1 legend card.",
                legendCards.Count == 1 && legendQuantity == 1,
                BuildLegendFailureReason(legendCards.Count, legendQuantity)),
            new(
                ChampionRequirementKey,
                "Champion included",
                "The 40-card main deck must contain at least 1 champion.",
                championCount >= 1,
                championCount >= 1
                    ? null
                    : "Add at least 1 champion to the main deck."),
            new(
                MainDeckRequirementKey,
                "40-card main deck",
                "The main deck must contain exactly 40 non-legend, non-rune, non-battlefield cards.",
                mainDeckCount == 40,
                mainDeckCount == 40
                    ? null
                    : $"The main deck currently has {mainDeckCount} of 40 cards."),
            BuildDomainRequirement(cards, selectedLegend),
            new(
                RuneRequirementKey,
                "12-card rune deck",
                "The rune deck must contain exactly 12 rune cards.",
                runeCount == 12,
                runeCount == 12
                    ? null
                    : $"The rune deck currently has {runeCount} of 12 cards."),
            new(
                BattlefieldRequirementKey,
                "3 different battlefields",
                "The deck must contain exactly 3 battlefield cards, all with different names.",
                battlefieldCount == 3 && distinctBattlefields == 3,
                BuildBattlefieldFailureReason(battlefieldCount, distinctBattlefields)),
        };

        return new DeckLegalityDto(
            requirements.All(requirement => requirement.IsSatisfied),
            requirements);
    }

    private static DeckLegalityRequirementDto BuildDomainRequirement(
        IReadOnlyList<DeckLegalityCard> cards,
        DeckLegalityCard? selectedLegend)
    {
        if (selectedLegend is null)
        {
            return new DeckLegalityRequirementDto(
                DomainRequirementKey,
                "Legend domains only",
                "All non-battlefield cards must stay within the selected legend's domains. Colorless cards are allowed.",
                false,
                "Choose exactly 1 legend before domain legality can be satisfied.");
        }

        var allowedDomains = selectedLegend.Domains
            .Where(domain => domain != CardDomain.Colorless)
            .ToHashSet();

        var invalidCards = cards
            .Where(card => card.Type is not CardType.Legend and not CardType.Battlefield)
            .Select(card => new InvalidDeckLegalityCard(
                card,
                card.Domains
                    .Where(domain => domain != CardDomain.Colorless && !allowedDomains.Contains(domain))
                    .Distinct()
                    .ToList()))
            .Where(entry => entry.InvalidDomains.Count > 0)
            .ToList();

        return new DeckLegalityRequirementDto(
            DomainRequirementKey,
            "Legend domains only",
            "All non-battlefield cards must stay within the selected legend's domains. Colorless cards are allowed.",
            invalidCards.Count == 0,
            invalidCards.Count == 0
                ? null
                : BuildDomainFailureReason(selectedLegend, invalidCards));
    }

    private static string BuildLegendFailureReason(int distinctLegendCards, int legendQuantity)
    {
        return legendQuantity switch
        {
            0 => "Add exactly 1 legend card.",
            _ when distinctLegendCards == 1 && legendQuantity > 1 => "Reduce the legend count to exactly 1 copy.",
            _ => $"The deck currently has {legendQuantity} legend cards. It needs exactly 1."
        };
    }

    private static string BuildBattlefieldFailureReason(int battlefieldCount, int distinctBattlefields)
    {
        if (battlefieldCount == 3 && distinctBattlefields < 3)
            return "Each battlefield must be a different card.";

        return $"The deck currently has {battlefieldCount} battlefield cards across {distinctBattlefields} different battlefields.";
    }

    private static string BuildDomainFailureReason(
        DeckLegalityCard selectedLegend,
        IReadOnlyList<InvalidDeckLegalityCard> invalidCards)
    {
        var allowedDomains = selectedLegend.Domains
            .Where(domain => domain != CardDomain.Colorless)
            .ToList();
        var allowedDomainLabel = allowedDomains.Count == 0
            ? "none"
            : string.Join(", ", allowedDomains);
        var invalidCardLabel = string.Join(
            "; ",
            invalidCards
                .Take(3)
                .Select(entry => $"{entry.Card.Name} ({string.Join(", ", entry.InvalidDomains)})"));
        var extraCount = invalidCards.Count > 3
            ? $" and {invalidCards.Count - 3} more"
            : string.Empty;

        return $"Allowed domains: {allowedDomainLabel}. Cards outside those domains: {invalidCardLabel}{extraCount}.";
    }
}

internal sealed record DeckLegalityCard(
    Guid CardId,
    string Name,
    CardType Type,
    CardSupertype Supertype,
    int Quantity,
    IReadOnlyList<CardDomain> Domains);

internal sealed record InvalidDeckLegalityCard(
    DeckLegalityCard Card,
    IReadOnlyList<CardDomain> InvalidDomains);
