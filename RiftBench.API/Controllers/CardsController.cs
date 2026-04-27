using Microsoft.AspNetCore.Mvc;

namespace RiftBench.API.Controllers;

[ApiController]
[Route("cards")]
public class CardsController : Controller
{
    [HttpGet("")]
    public IActionResult GetCards()
    {
        return Ok();
    }
}