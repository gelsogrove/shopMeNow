# Hero background clips

The landing hero plays these in order, cross-fading between them:

    hiking.mp4 · rafting.mp4 · bike.mp4 · ski.mp4 · lake.mp4 · castle.mp4

Any subset works — missing files are skipped, and with none of them present
the hero falls back to the still photo. The order, the filenames AND the chat
question each clip carries are in `src/components/HeroBackdrop.tsx` (`CLIPS`):
a clip added here without an entry there will never play.

Desktop only: below 1024px the hero shows the photo and no video at all.

## What each clip should be

Short (6–10s), no people talking, no on-screen text, no logos. The clip is
BACKGROUND: it plays muted under the headline and the login card, behind a
dark veil, so anything busy or high-contrast fights the copy. Wide shots with
slow movement work; fast cuts and handheld footage do not.

Each clip pairs with a question a guest would ask while looking at it. Pick
footage that provokes an obvious question — someone hiking, cycling, skiing —
rather than empty scenery, which provokes none.

## Encoding

Keep each clip UNDER 1.5 MB. A tourist office is often on a rural connection,
and the whole point of the photo-first design is that the page is usable
before any of this arrives. 360p is enough: the footage sits behind a dark
veil and is motion-blurred, so resolution buys nothing.

    ffmpeg -i source.mov -vf "scale=640:-2,fps=25" -c:v libx264 -crf 32 \
      -profile:v main -pix_fmt yuv420p -an -movflags +faststart hiking.mp4

`-an` strips the audio (the video is muted anyway — shipping an unused audio
track is dead weight). `+faststart` puts the index at the front so playback
can begin before the file is fully downloaded.

## Licensing

**The six clips currently here are from [coverr.co](https://coverr.co)**, whose
licence grants "an irrevocable, non-exclusive, worldwide copyright license to
download, copy, modify, perform, and use videos... for free, including for
commercial purposes". No attribution required. Verified 2026-09-15.

What that licence does NOT cover, and stays your responsibility:

- **Trademarks, logos and brands** visible in the footage.
- **Privacy and publicity rights** of recognisable people in it.
- Reselling the clips, or offering them as part of a service that supplies
  video to others. (Using them as this site's background is fine.)

🚨 These are PLACEHOLDERS. Replace them with the tenant's own footage of the
actual territory as soon as there is any: it sidesteps the two risks above
entirely, and a guest recognising the real place is worth more than any stock
mountain.

For new clips: only footage you own, or licensed for commercial use. Coverr,
Pexels and Pixabay all allow it without attribution. **iStock, Getty,
Shutterstock and Adobe Stock do NOT** — they need a paid licence, even when
a free site links to them as an ad. YouTube rips never do, whatever the video
says in its description.
