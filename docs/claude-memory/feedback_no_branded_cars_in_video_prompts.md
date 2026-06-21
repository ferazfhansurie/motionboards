---
name: Strip car brand names from video prompts (Seedance flags them)
description: Seedance 2.0 sensitivity filter trips on real automotive brand names like "Honda Civic", "Mazda 2", "Mercedes" — use generic descriptors and let @ImageN refs carry the visual identity
type: feedback
originSessionId: fcf27d1d-7a0e-4abc-b16c-b4a4838f2b7e
---
When writing **video prompts** (Seedance 2.0 I2V/S2E especially, but assume the same for Veo/Wan/Sora), **never use real-world automotive brand names** like "Honda Civic", "Mazda 2", "Mercedes-Benz C-Class", "BMW", "Lambo", "Tesla", etc. They reliably trip the model's sensitivity filter and the run fails with `ModelError: The input or output was flagged as sensitive (E005)`.

**Why:** Firaz hit this on the ESP Wrapz spot — the prompt named "Honda Civic" and "Mazda 2" explicitly and Seedance refused to generate. Stripping the brand names and using generic descriptors ("sedan", "compact sedan", "yellow car", "emerald car") cleared the block.

**How to apply:**
- Use generic body-style words: "sedan", "hatchback", "SUV", "compact", "two-door"
- Use color + position to disambiguate: "the emerald car on the left", "the yellow car on the right", "the middle white car"
- Let the **reference image** (`@ImageN`) carry the visual identity — the prompt doesn't need to name the make/model because the reference already locks the geometry, grille, wheels, and proportions
- Add an explicit constraint at the bottom: *"No automotive brand names or badges visible. No real-world manufacturer logos."*
- If the NB2-generated staging backplate has visible branded badges/wheels that Seedance is reading, regenerate the backplate with: *"No visible badges, emblems, or brand markings on any car — chrome trim only, blank grilles, generic wheel designs."*

This rule probably extends to other categories the filter is touchy about: real watch brands (Rolex, Omega), real fashion houses (Gucci, LV), real tech products (iPhone). Default to generic descriptors + reference-image identity lock unless the user explicitly wants the brand visible (and even then, expect to fight the filter).
