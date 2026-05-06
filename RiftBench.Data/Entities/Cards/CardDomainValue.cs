namespace RiftBench.Data.Entities.Cards;

public sealed class CardDomainValue
{
    public Guid CardId { get; set; }
    public Card Card { get; set; } = null!;

    public CardDomain Domain { get; set; }
}
