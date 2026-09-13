# Mafia de Cuba original UI artwork

Asset: `mafia-atlas.png`, 1448 × 1086, four columns by three rows.
Generated with OpenAI imagegen on 2026-09-13 for this project. Original illustration inspired by the user's physical tabletop reference: teal/gold cigar box, diamonds, amber bottles, and circular role portrait chips. No official scans, lettering or game logo were used.

Tiles, left to right:
1. Closed cigar box, open cigar box, diamonds, Joker bottle.
2. Godfather, Loyal Henchman, FBI Agent, CIA Agent.
3. Driver, Thief, Street Urchin, Cleaner.

Generation prompt:

> Create an ORIGINAL game UI asset atlas for a 1950s Havana social deduction tabletop game. Inspired by physical ornate teal and gold cigar boxes and circular portrait role chips, no official game logo, no copied trademark, NO WORDS OR LETTERS anywhere. Strict exactly FOUR columns and THREE rows equal-sized rectangular panels, each centered object fully contained with generous margin on uniform deep warm mahogany background, no visible grid lines. Landscape 4:3 composition. Painterly richly detailed vintage lithograph with clear silhouettes suitable small icons. Row1 left to right: closed luxurious teal gold cigar box three-quarter view; open same box with empty warm wood interior seen from above; pile of clear sparkling white diamonds; small amber whiskey bottle with cream blank label. Row2: circular gold rim Godfather older man white Panama hat cream suit; circular ivory rim loyal henchman white suit black tie; circular royal blue rim FBI detective dark suit fedora; circular navy blue rim CIA detective sunglasses navy suit. Row3: circular green rim driver with green cap and steering wheel; circular burgundy rim thief in black with diamond; circular ochre rim street urchin young adult with brown cap; circular charcoal rim cleaner in grey suit gloves. Portraits are busts facing viewer with distinct prop silhouettes. Beautiful warm cream ink highlights and aged gold ornament, muted jewel tones, cohesive premium boardgame illustration. Keep exact twelve panels, object sizes consistent.

The SVG viewports in `MafiaArt.tsx` select atlas tiles, trimming row margins so neighboring illustrations do not appear at the edge. Private take animations are client-local, after a successful callable; public animations use only the closed box and public holder ID.
