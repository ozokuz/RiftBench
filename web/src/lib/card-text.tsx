import type { ReactNode } from "react"
import { Fragment } from "react"
import { cn } from "@/lib/utils"

type TextToken = {
  type: "text"
  value: string
}

type KeywordToken = {
  type: "keyword"
  value: string
}

type IconToken = {
  type: "icon"
  value: string
}

type NewlineToken = {
  type: "newline"
}

export type CardTextToken = TextToken | KeywordToken | IconToken | NewlineToken

type IconMetadata = {
  src: string
  label: string
  invertToWhite: boolean
}

const TOKEN_PATTERN = /:rb_[a-z0-9_]+:|\[[^\]]+\]|\n/g
const RICH_TEXT_LINE_BREAK_PATTERN = /<br\s*\/?>/gi
const RICH_TEXT_PARAGRAPH_PATTERN = /<\/p>\s*<p[^>]*>/gi
const RICH_TEXT_TAG_PATTERN = /<[^>]+>/g

export const SUPPORTED_KEYWORDS = new Set([
  "ACCELERATE",
  "ACTION",
  "LEGION",
  "DEFLECT",
  "ASSAULT",
  "HIDDEN",
  "REACTION",
  "GANKING",
  "MIGHTY",
  "SHIELD",
  "TANK",
  "VISION",
  "DEATHKNELL",
  "TEMPORARY",
  "EQUIP",
  "QUICK-DRAW",
  "ADD",
  "WEAPONMASTER",
  "REPEAT",
  "UNIQUE",
  "HUNT",
  "AMBUSH",
  "BACKLINE",
  "BUFF",
  "11",
  "STUN",
])

export const ICON_MAP: Record<string, IconMetadata> = {
  rb_exhaust: {
    src: "/icons/other/Tap.png",
    label: "Exhaust",
    invertToWhite: true,
  },
  rb_rune_rainbow: {
    src: "/icons/other/RainbowRune.png",
    label: "Add any rune",
    invertToWhite: false,
  },
}

export const FALLBACK_ICON: IconMetadata = {
  src: "/icons/other/SwordIconRB.png",
  label: "Card text icon",
  invertToWhite: true,
}

export function resolveCardTextSource(
  plainText: null | string | undefined,
  richText: null | string | undefined
): string {
  if (plainText && plainText.trim().length > 0) {
    return plainText
  }

  if (richText && richText.trim().length > 0) {
    return normalizeRichText(richText)
  }

  return "No card text."
}

export function normalizeRichText(richText: string): string {
  const normalized = richText
    .replace(RICH_TEXT_LINE_BREAK_PATTERN, "\n")
    .replace(RICH_TEXT_PARAGRAPH_PATTERN, "\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<\/p>/gi, "")
    .replace(RICH_TEXT_TAG_PATTERN, "")

  return decodeHtmlEntities(normalized)
}

export function tokenizeCardText(text: string): CardTextToken[] {
  const tokens: CardTextToken[] = []
  let cursor = 0
  let match: null | RegExpExecArray

  TOKEN_PATTERN.lastIndex = 0

  while ((match = TOKEN_PATTERN.exec(text)) !== null) {
    if (match.index > cursor) {
      tokens.push({
        type: "text",
        value: text.slice(cursor, match.index),
      })
    }

    const value = match[0]

    if (value === "\n") {
      tokens.push({ type: "newline" })
      cursor = TOKEN_PATTERN.lastIndex
      continue
    }

    if (value.startsWith(":rb_")) {
      tokens.push({
        type: "icon",
        value: value.slice(1, -1),
      })

      cursor = TOKEN_PATTERN.lastIndex
      continue
    }

    const keywordValue = value.slice(1, -1)
    const normalizedKeyword = keywordValue.toUpperCase()

    if (SUPPORTED_KEYWORDS.has(normalizedKeyword)) {
      tokens.push({
        type: "keyword",
        value: normalizedKeyword,
      })
    } else {
      tokens.push({
        type: "text",
        value,
      })
    }

    cursor = TOKEN_PATTERN.lastIndex
  }

  if (cursor < text.length) {
    tokens.push({
      type: "text",
      value: text.slice(cursor),
    })
  }

  return tokens
}

export function renderCardText(text: string): ReactNode {
  return tokenizeCardText(text).map((token, index) => {
    if (token.type === "text") {
      return <Fragment key={`text-${index}`}>{token.value}</Fragment>
    }

    if (token.type === "newline") {
      return <br key={`newline-${index}`} />
    }

    if (token.type === "keyword") {
      return (
        <span
          key={`keyword-${index}`}
          className="mx-[0.14em] inline-flex items-baseline bg-[#17655f] px-2 py-[0.06em] align-baseline text-[0.72em] font-semibold tracking-[0.02em] text-white italic [clip-path:polygon(8%_0,100%_0,92%_100%,0_100%)]"
        >
          {token.value}
        </span>
      )
    }

    const icon = ICON_MAP[token.value] ?? FALLBACK_ICON

    return (
      <span
        key={`icon-${index}`}
        className="mx-[0.14em] inline-flex items-baseline align-baseline"
      >
        <img
          src={icon.src}
          alt=""
          aria-hidden="true"
          className={cn(
            "inline-block h-[0.95em] w-[0.95em] translate-y-[0.08em] object-contain align-baseline",
            icon.invertToWhite && "brightness-0 invert"
          )}
        />
        <span className="sr-only">{icon.label}</span>
      </span>
    )
  })
}

function decodeHtmlEntities(value: string): string {
  if (typeof document === "undefined") {
    return value
  }

  const textarea = document.createElement("textarea")
  textarea.innerHTML = value

  return textarea.value
}
