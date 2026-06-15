import { extractVideoUrl, formatWelcomeReply } from "../../utils/welcome-video"

// The presentation video URL is authored INSIDE the welcome message (the custom
// module greeting). These tests pin the extractor + formatter that turn that
// authored reply into the channel-agnostic welcome-video layout. WHAT/WHY is
// documented per-case because this is the single source of truth for the
// "URL in the welcome message → rendered video" behaviour (widget + WhatsApp).

// A realistic first-turn demowash reply: greeting, the bare video URL on its own
// line, then the location question. This is exactly what the LLM emits.
const REPLY = [
  "Ciao! 👋 Sono l'assistente virtuale di **Demowash**, sono qui per aiutarti.",
  "",
  "https://www.youtube.com/watch?v=K4TOrB7at0Y",
  "",
  "In quale lavanderia ti trovi? Le nostre sedi sono: **Barcelona**, **Mataró**, **Rubí**, **Sant Cugat** e **Terrassa**.",
].join("\n")

describe("extractVideoUrl", () => {
  // WHAT: finds the YouTube URL and returns the text without it.
  // WHY: the visible message must never show the raw link — the renderer shows
  // a video instead.
  it("extracts a YouTube URL and strips it (collapsing the blank gap)", () => {
    const out = extractVideoUrl(REPLY)
    expect(out).not.toBeNull()
    expect(out!.url).toBe("https://www.youtube.com/watch?v=K4TOrB7at0Y")
    expect(out!.text).not.toContain("youtube.com")
    // greeting and question survive, separated by a single blank line.
    expect(out!.text).toBe(
      "Ciao! 👋 Sono l'assistente virtuale di **Demowash**, sono qui per aiutarti.\n\nIn quale lavanderia ti trovi? Le nostre sedi sono: **Barcelona**, **Mataró**, **Rubí**, **Sant Cugat** e **Terrassa**."
    )
  })

  // WHAT: youtu.be short links and .mp4 are also recognized.
  it("recognizes youtu.be and direct .mp4 links", () => {
    expect(extractVideoUrl("hi https://youtu.be/K4TOrB7at0Y bye")!.url).toBe(
      "https://youtu.be/K4TOrB7at0Y"
    )
    expect(extractVideoUrl("see https://cdn.x.com/intro.mp4")!.url).toBe(
      "https://cdn.x.com/intro.mp4"
    )
  })

  // WHAT: trailing sentence punctuation is not part of the URL.
  it("trims trailing punctuation from the URL", () => {
    expect(
      extractVideoUrl("watch https://youtu.be/K4TOrB7at0Y.")!.url
    ).toBe("https://youtu.be/K4TOrB7at0Y")
  })

  // WHAT: a non-video link (a normal website) is ignored.
  // WHY: only presentation videos become a card; other links stay inline text.
  it("returns null when there is no video URL", () => {
    expect(extractVideoUrl("visit https://demowash.example for hours")).toBeNull()
    expect(extractVideoUrl("no links here")).toBeNull()
    expect(extractVideoUrl("")).toBeNull()
  })
})

describe("formatWelcomeReply", () => {
  // WHAT: YouTube → two-message split (text + thumbnail image with caption).
  // WHY: mirrors the playground WelcomeVideoCard order on WhatsApp.
  it("splits a YouTube welcome into greeting+intro and thumbnail+caption", () => {
    const out = formatWelcomeReply(REPLY, "it")
    expect(out?.type).toBe("split")
    if (out?.type !== "split") throw new Error("expected split")
    // message 1 = greeting + localized intro line.
    expect(out.textMessage).toContain("Sono l'assistente virtuale")
    expect(out.textMessage).toContain("Prima di iniziare") // it intro
    // message 2 = real YouTube thumbnail image + caption (rest + link).
    expect(out.imageUrl).toBe(
      "https://img.youtube.com/vi/K4TOrB7at0Y/hqdefault.jpg"
    )
    expect(out.caption).toContain("In quale lavanderia ti trovi")
    expect(out.caption).toContain("https://www.youtube.com/watch?v=K4TOrB7at0Y")
  })

  // WHAT: non-YouTube (.mp4) → single inline message carrying intro + URL.
  // WHY: WhatsApp can't resolve a thumbnail, so the link goes out inline.
  it("returns an inline message for a non-YouTube (.mp4) video", () => {
    const reply = "Welcome!\n\nhttps://cdn.x.com/intro.mp4\n\nHow can I help?"
    const out = formatWelcomeReply(reply, "en")
    expect(out?.type).toBe("inline")
    if (out?.type !== "inline") throw new Error("expected inline")
    expect(out.text).toContain("https://cdn.x.com/intro.mp4")
    expect(out.text).toContain("Before we start") // en intro
  })

  // WHAT: no video URL → null (caller sends the reply unchanged).
  it("returns null when the reply has no video URL", () => {
    expect(formatWelcomeReply("Just a greeting\n\nHow can I help?", "en")).toBeNull()
  })
})
