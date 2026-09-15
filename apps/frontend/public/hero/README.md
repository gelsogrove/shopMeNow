# Hero background clips

Drop the mp4s here and the landing hero starts playing them, in this order:

    mountain.mp4 · ski.mp4 · horse.mp4 · rafting.mp4 · food.mp4

Any subset works — missing files are skipped, and with none of them present
the hero falls back to the still photo. The order and the filenames are in
`src/components/HeroBackdrop.tsx` (`CLIPS`).

## What each clip should be

Short (6–10s), no people talking, no on-screen text, no logos. The clip is
BACKGROUND: it plays muted under the headline and the login form, behind a
near-white gradient, so anything busy or high-contrast in the upper half
fights the copy. Wide landscape shots with slow movement work; fast cuts and
handheld footage do not.

## Encoding

Keep each clip UNDER 3 MB — a tourist office is often on a rural connection,
and the whole point of the photo-first design is that the page is usable
before any of this arrives.

    ffmpeg -i source.mov -vf "scale=1920:-2,fps=25" -c:v libx264 -crf 30 \
      -profile:v main -pix_fmt yuv420p -an -movflags +faststart mountain.mp4

`-an` strips the audio (the video is muted anyway — shipping an unused audio
track is dead weight). `+faststart` puts the index at the front so playback
can begin before the file is fully downloaded.

## Licensing

🚨 Only footage you own or that is licensed for commercial use. Pexels and
Pixabay both allow it without attribution; YouTube rips do not, whatever the
video says in its description.
