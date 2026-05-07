using Microsoft.AspNetCore.Mvc;

using RiftBench.API.Models.Cards;
using RiftBench.API.Models.Common;
using RiftBench.API.Services;

namespace RiftBench.API.Controllers;

[ApiController]
[Route("cards")]
public sealed class CardsController : ControllerBase
{
    private readonly CardSearchService _cardSearchService;

    public CardsController(CardSearchService cardSearchService)
    {
        _cardSearchService = cardSearchService;
    }

    [HttpGet("")]
    [ProducesResponseType<PagedResultDto<CardSummaryDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResultDto<CardSummaryDto>>> GetCards(
        [FromQuery] CardSearchRequest request,
        CancellationToken cancellationToken)
    {
        return Ok(await _cardSearchService.SearchAsync(request, cancellationToken));
    }

    [HttpGet("{cardId:guid}")]
    [ProducesResponseType<CardDetailDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CardDetailDto>> GetCard(
        Guid cardId,
        CancellationToken cancellationToken)
    {
        var result = await _cardSearchService.GetCardAsync(cardId, cancellationToken);

        return result.Status == ServiceResultStatus.Ok
            ? Ok(result.Value)
            : NotFound();
    }
}
