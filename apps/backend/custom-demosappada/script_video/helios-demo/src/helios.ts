import { Helios } from '@helios-project/core';

export const helios = new Helios({
  fps: 30,
  duration: 10 // seconds — test clip: "il primo push" (Scena 2)
});

// Bind to document timeline (allows Helios to control the animation)
helios.bindToDocumentTimeline();
