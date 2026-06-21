---
name: Use real photos for characters, AI for things
type: feedback
description: Firaz uses real uploaded photos for every character/face in ad spots; NB2 generates only objects, environments, and staging backplates
originSessionId: fcf27d1d-7a0e-4abc-b16c-b4a4838f2b7e
---
When producing ad spots / videos for Firaz, **never use Nano Banana 2 (or any image model) to generate human characters from scratch.** All character identity — faces, wardrobe, age, ethnicity — comes from **real photos** that Firaz uploads as `@ImageN` references.

**Why:** he stated explicitly that he "won't use the nano banana 2 to create characters, just things" and "will get all character images to put as reference in the seedance prompt." This is a deliberate creative + legal choice: avoids licensing greyzone of AI faces, sidesteps NB2's wobbly character consistency across generations, and grounds the work in real cast for client deliverables.

**How to apply:**
- For any new ad spot brief: ask Firaz to source the cast photos *before* writing the Seedance prompt. Don't generate placeholder character images.
- NB2's job is **objects, environments, staging backplates** — cars (empty cabins), interiors, products, signage, scenery
- Seedance's job is to composite the real-photo characters into the NB2 backplates — explicit `Use @ImageN as [character]'s face and wardrobe identity… composite into [specific seat/position] of @ImageM` syntax
- If a needed character isn't already in his uploads, recommend he photograph someone matching the role rather than generating one

This rule does not apply to objects, vehicles, environments, or animated mascots — those are NB2-territory.
