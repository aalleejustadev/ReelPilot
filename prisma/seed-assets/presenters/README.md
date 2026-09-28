# Stock presenter portraits (placeholders)

Illustrated portraits made with **Avataaars** by Pablo Stanley
(https://avataaars.com/), via DiceBear 9 — licensed **free for personal and
commercial use**. Each presenter's look was set by hand (not random) so it
fits the name: women have long or styled hair, men short hair with a beard
or glasses, everyone smiles, and skin tones and hair colours vary.

| Portrait | Top | Hair | Skin | Eyes | Extras | Clothes | Background |
|---|---|---|---|---|---|---|---|
| maya | longButNotTooLong | 4a312c | edb98a | happy | — | blazerAndShirt 5199e4 | ffd5dc |
| marcus | theCaesar | 2c1b18 | 614335 | happy | beardLight 2c1b18 | collarAndSweater 3c4f5c | b6e3f4 |
| emma | straight01 | d6b370 | ffdbb4 | default | — | shirtScoopNeck 25557c | c0aede |
| diego | shortWaved | 2c1b18 | d08b5b | default | beardMedium 2c1b18 | hoodie ff5c5c | ffdfbf |
| chloe | curvy | c93305 | ffdbb4 | happy | — | shirtVNeck ff488e | d1f4d9 |
| oliver | theCaesarAndSidePart | 724133 | edb98a | default | prescription02 glasses | blazerAndSweater 262e33 | ffd5dc |
| priya | straightAndStrand | 2c1b18 | ae5d29 | default | — | shirtScoopNeck 65c9ff | c0aede |
| sam | shortCurly | a55728 | ffdbb4 | happy | — | shirtCrewNeck a7ffc4 | d1f4d9 |

All: eyebrows `defaultNatural`, mouth `smile`; rendered at 512×512 PNG.

To use real portraits (owner decision 2026-09-25: AI-generated photoreal
faces with a commercial licence), replace each `<slug>.png` with a square
PNG, JPEG or WebP of at least 512×512 px, keeping the file name, and run
`npx prisma db seed`. The seed uploads a portrait again only when its file
changes.
