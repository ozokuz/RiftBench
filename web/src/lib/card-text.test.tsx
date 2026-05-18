// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  normalizeRichText,
  renderCardText,
  resolveIconMetadata,
  resolveCardTextSource,
  tokenizeCardText,
} from "@/lib/card-text"

describe("card text rendering", () => {
  it("renders tap icon, reaction badge, and preserves the separator colon", () => {
    const { container } = render(
      <div>{renderCardText(":rb_exhaust:: [Reaction] — Draw 1.")}</div>
    )

    expect(screen.getByText("REACTION")).toBeTruthy()
    expect(container.innerHTML).not.toContain(":rb_exhaust:")
    expect(container.textContent).toContain(": REACTION — Draw 1.")

    const icon = container.querySelector("img")
    expect(icon?.getAttribute("src")).toBe("/icons/other/Tap.png")
    expect(icon?.className).toContain("brightness-0")
    expect(icon?.className).toContain("invert")
  })

  it("renders add badge and rainbow rune icon without white inversion", () => {
    const { container } = render(
      <div>{renderCardText("[Add] :rb_rune_rainbow:")}</div>
    )

    expect(screen.getByText("ADD")).toBeTruthy()

    const icon = container.querySelector("img")
    expect(icon?.getAttribute("src")).toBe("/icons/other/RainbowRune.png")
    expect(icon?.className).not.toContain("brightness-0")
    expect(icon?.className).not.toContain("invert")
  })

  it("renders plain text unchanged when there are no tokens", () => {
    const text = "I can't be chosen by enemy spells and abilities."
    const { container } = render(<div>{renderCardText(text)}</div>)

    expect(container.textContent).toBe(text)
    expect(container.querySelector("img")).toBeNull()
  })

  it("uses the fallback icon for unknown shortcodes", () => {
    const { container } = render(
      <div>{renderCardText("Gain :rb_unknown: now.")}</div>
    )

    const icon = container.querySelector("img")
    expect(icon?.getAttribute("src")).toBe("/icons/other/SwordIconRB.png")
    expect(container.innerHTML).not.toContain(":rb_unknown:")
    expect(container.textContent).toContain("Gain ")
    expect(container.textContent).toContain(" now.")
  })

  it("maps domain rune tokens to the domain icon set", () => {
    const icon = resolveIconMetadata("rb_rune_body")

    expect(icon.src).toBe("/icons/domain/Body.png")
    expect(icon.label).toBe("Body rune")
    expect(icon.invertToWhite).toBe(true)
  })

  it("maps might tokens to the sword icon", () => {
    const icon = resolveIconMetadata("rb_might")

    expect(icon.src).toBe("/icons/other/SwordIconRB.png")
    expect(icon.label).toBe("Might")
    expect(icon.invertToWhite).toBe(true)
  })

  it("renders supported keywords as badges", () => {
    render(<div>{renderCardText("[Tank] [Quick-Draw] [11]")}</div>)

    expect(screen.getByText("TANK")).toBeTruthy()
    expect(screen.getByText("QUICK-DRAW")).toBeTruthy()
    expect(screen.getByText("11")).toBeTruthy()
  })

  it("leaves unsupported bracket tokens as plain text", () => {
    const { container } = render(
      <div>{renderCardText("[SomethingElse] is unchanged.")}</div>
    )

    expect(container.textContent).toBe("[SomethingElse] is unchanged.")
    expect(screen.queryByText("SOMETHINGELSE")).toBeNull()
  })

  it("falls back to normalized rich text when plain text is missing", () => {
    const resolved = resolveCardTextSource(
      null,
      "<p>[Action]</p><p>:rb_exhaust:: Draw 1.<br />Again.</p>"
    )

    expect(resolved).toBe("[Action]\n:rb_exhaust:: Draw 1.\nAgain.")

    const { container } = render(<div>{renderCardText(resolved)}</div>)
    expect(screen.getByText("ACTION")).toBeTruthy()
    expect(container.querySelector("br")).toBeTruthy()
  })

  it("tokenizes newline boundaries explicitly", () => {
    expect(tokenizeCardText("First\nSecond")).toEqual([
      { type: "text", value: "First" },
      { type: "newline" },
      { type: "text", value: "Second" },
    ])
  })

  it("normalizes rich text by stripping tags and decoding entities", () => {
    expect(normalizeRichText("<p>Tom &amp; Jerry<br />Hi</p>")).toBe(
      "Tom & Jerry\nHi"
    )
  })
})
