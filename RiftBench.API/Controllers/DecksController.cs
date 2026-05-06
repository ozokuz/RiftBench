using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

using RiftBench.API.Extensions;
using RiftBench.API.Models.Common;
using RiftBench.API.Models.Decks;
using RiftBench.API.Services;

namespace RiftBench.API.Controllers;

[ApiController]
[Route("")]
public sealed class DecksController : ControllerBase
{
    private readonly DeckService _deckService;

    public DecksController(DeckService deckService)
    {
        _deckService = deckService;
    }

    [HttpGet("decks/browse")]
    [ProducesResponseType<PagedResultDto<DeckListItemDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResultDto<DeckListItemDto>>> BrowseDecks(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        return Ok(await _deckService.GetPublicDecksAsync(page, pageSize, cancellationToken));
    }

    [HttpGet("users/{userId:guid}/decks")]
    [ProducesResponseType<DeckTreeDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DeckTreeDto>> GetUserDecks(
        Guid userId,
        CancellationToken cancellationToken)
    {
        var result = await _deckService.GetPublicUserDeckTreeAsync(userId, cancellationToken);
        return ToActionResult(result);
    }

    [Authorize]
    [HttpGet("decks")]
    [ProducesResponseType<DeckTreeDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<DeckTreeDto>> GetMyDecks(
        [FromQuery] bool includeArchived = false,
        CancellationToken cancellationToken = default)
    {
        var userId = User.GetRequiredUserId();
        return Ok(await _deckService.GetCurrentUserDeckTreeAsync(userId, includeArchived, cancellationToken));
    }

    [HttpGet("decks/{deckId:guid}")]
    [ProducesResponseType<DeckDetailDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DeckDetailDto>> GetDeck(
        Guid deckId,
        CancellationToken cancellationToken)
    {
        var result = await _deckService.GetDeckAsync(deckId, User.GetUserIdOrNull(), cancellationToken);
        return ToActionResult(result);
    }

    [Authorize]
    [HttpPost("decks")]
    [ProducesResponseType<DeckDetailDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<DeckDetailDto>> CreateDeck(
        CreateDeckRequest request,
        CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var result = await _deckService.CreateDeckAsync(userId, request, cancellationToken);

        return result.Status == ServiceResultStatus.Created
            ? CreatedAtAction(nameof(GetDeck), new { deckId = result.Value!.Id }, result.Value)
            : ToActionResult(result);
    }

    [Authorize]
    [HttpPut("decks/{deckId:guid}/settings")]
    [ProducesResponseType<DeckDetailDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DeckDetailDto>> UpdateDeckSettings(
        Guid deckId,
        UpdateDeckSettingsRequest request,
        CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var result = await _deckService.UpdateDeckSettingsAsync(deckId, userId, request, cancellationToken);
        return ToActionResult(result);
    }

    [Authorize]
    [HttpPut("decks/{deckId:guid}/cards")]
    [ProducesResponseType<DeckDetailDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DeckDetailDto>> ReplaceDeckCards(
        Guid deckId,
        ReplaceDeckContentsRequest request,
        CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var result = await _deckService.ReplaceDeckContentsAsync(deckId, userId, request, cancellationToken);
        return ToActionResult(result);
    }

    [Authorize]
    [HttpDelete("decks/{deckId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteDeck(
        Guid deckId,
        CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var result = await _deckService.DeleteDeckAsync(deckId, userId, cancellationToken);
        return ToActionResult(result);
    }

    [Authorize]
    [HttpPost("decks/folders")]
    [ProducesResponseType<DeckFolderDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<DeckFolderDto>> CreateFolder(
        CreateDeckFolderRequest request,
        CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var result = await _deckService.CreateFolderAsync(userId, request, cancellationToken);

        return result.Status == ServiceResultStatus.Created
            ? CreatedAtAction(nameof(GetMyDecks), routeValues: null, value: result.Value)
            : ToActionResult(result);
    }

    [Authorize]
    [HttpPut("decks/folders/{folderId:guid}")]
    [ProducesResponseType<DeckFolderDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DeckFolderDto>> UpdateFolder(
        Guid folderId,
        UpdateDeckFolderRequest request,
        CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var result = await _deckService.UpdateFolderAsync(folderId, userId, request, cancellationToken);
        return ToActionResult(result);
    }

    [Authorize]
    [HttpDelete("decks/folders/{folderId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DeleteFolder(
        Guid folderId,
        CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var result = await _deckService.DeleteFolderAsync(folderId, userId, cancellationToken);
        return ToActionResult(result);
    }

    private ActionResult<T> ToActionResult<T>(ServiceResult<T> result)
    {
        return result.Status switch
        {
            ServiceResultStatus.Ok => Ok(result.Value),
            ServiceResultStatus.Created => StatusCode(StatusCodes.Status201Created, result.Value),
            ServiceResultStatus.BadRequest => BadRequest(new ValidationProblemDetails(result.Errors!.ToDictionary())),
            ServiceResultStatus.NotFound => NotFound(),
            ServiceResultStatus.Conflict => Conflict(result.Message),
            _ => StatusCode(StatusCodes.Status500InternalServerError)
        };
    }

    private IActionResult ToActionResult(ServiceResult result)
    {
        return result.Status switch
        {
            ServiceResultStatus.NoContent => NoContent(),
            ServiceResultStatus.BadRequest => BadRequest(new ValidationProblemDetails(result.Errors!.ToDictionary())),
            ServiceResultStatus.NotFound => NotFound(),
            ServiceResultStatus.Conflict => Conflict(result.Message),
            _ => StatusCode(StatusCodes.Status500InternalServerError)
        };
    }
}
