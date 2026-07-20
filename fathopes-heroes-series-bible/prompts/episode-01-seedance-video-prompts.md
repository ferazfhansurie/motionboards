# Episode 1 Seedance Video Prompts

Use these after generating the five Nano Banana storyboard images.

Pipeline:

- One Seedance generation = 1 multi-panel storyboard sheet + 1 to 3 character reference images + 1 prompt = one 15-second video clip.
- Each clip should animate the storyboard sheet panel-by-panel as one continuous scene, following Panel 1, then Panel 2, then Panel 3, then Panel 4.
- Preserve the intent, camera angle, staging, and action from each panel, then add camera movement, character acting, and environmental motion between panels.
- Output format: final video must be vertical 9:16. The input storyboard sheet is a vertical 9:16 sheet with four vertical 9:16 panels in a 2x2 grid.
- Each prompt includes the complete action/dialogue flow for its full 15-second clip. Do not stop at the first action or first spoken line; animate the whole beat from start to finish.
- Do not add text overlays, captions, subtitles, speech bubbles, watermarks, title cards, or readable UI.
- Add subtitles later in editing, not inside generation.

## Global Seedance Rules

Visual style:
Mixed-media animated comedy in a real Malaysian mamak/warung back alley. The environment must stay realistic 3D/photographic: wet concrete, real longkang drain, real metal tong, real oil stains, real fryer area, natural shadows, practical fluorescent lighting, lens depth, handheld camera feel. The characters must remain 2D comic/anime cutouts composited into the real world: visible ink outlines, subtle halftone/comic paper texture, hand-drawn shading, flatter cel colors, expressive faces, crisp cel highlights.

Tone:
Playful mixed-reality cartoon energy in ordinary Malaysian life: absurd action over a mundane used-cooking-oil problem. Funny-serious, grounded, visually lively, but not futuristic and not a corporate explainer. Use a mixed-media feel similar in spirit to animated characters living inside a real-world sitcom environment, without copying any specific existing show.

Continuity:
Use the same warung back alley across all clips. Keep the drain, tong, vendor, oil container, lighting direction, and spatial layout consistent. Early clips are daytime/busy kitchen. Later clips are evening/closing time with deeper shadows.

Motion rules:
Keep motion readable in vertical 9:16 framing. Prioritize character acting, clear object movement, and one memorable camera move per clip. Do not overanimate the background. Do not make the camera spin wildly. Each clip should have a unique camera style and unique activity. The input storyboard is a 4-panel vertical sheet; use it as a beat map, not as a split-screen layout in the final video. The final video should be one continuous 15-second 9:16 scene.

Voice consistency:
All character voices are Malaysian-accented English/Manglish (Klang Valley), warm and natural, even on full-English lines (e.g. Sparron's "Still usable. No water contamination."). Malay lines must be Bahasa Melayu Malaysia, NOT Bahasa Indonesia or Jakarta accent: final "-a" is pronounced as a schwa (saya = "sa-yuh", apa = "a-puh", kereta = "ke-re-tuh"), soft "r", relaxed KL intonation. No Indonesian accent, no neutral American accent, no British RP, no generic international voice. Dr.UP sounds like a confident Malaysian TV presenter, Sparron sounds like a sharp KL young-professional, Kit sounds heavier BM-influenced and gruff, Glinciro sounds smooth and theatrical Malaysian-English, vendors sound like real unpolished mamak/warung speech.

Character uniqueness (critical):
Each character is a single, unique individual. There is exactly ONE Kit, ONE Sparron, ONE Dr.UP, ONE Glinciro, and ONE vendor in the entire scene. The character reference images are identity locks, not instructions to place multiple copies in frame. Never clone, duplicate, mirror, or twin any character. Never show two of the same hero in the same shot, in the background, or in a reflection. If a character reference is provided, use it to render that one person only. Total on-screen cast per clip is only the characters explicitly named in that clip's beats plus the single vendor.

Universal negative prompt:
No duplicate characters, no cloned or twinned heroes, no two of the same person in frame, no repeated Kit/Sparron/Dr.UP/Glinciro, no background copies of a main character, no mirrored duplicate in reflections. No text overlays, no subtitles, no captions, no speech bubbles, no title cards, no readable labels, no watermarks. No cyberpunk, no futuristic neon, no glossy corporate ad, no Marvel-style spectacle, no fantasy setting, no full 3D Pixar style, no random extra superheroes, no robots, no weapons, no lasers, no huge explosions, no city destruction. Do not change character outfits. Do not make the vendor young. Do not show Glinciro stealing the tong. Do not let black liquid enter the oil. Do not make the real environment illustrated; keep it real 3D/photographic while the characters stay 2D comic-textured.

---

## Seedance Clip 1: 0-15s - Kit Stops The Pour

Inputs:

- Storyboard image 1
- `@kit_ref`
- optional `@location_ref`

Prompt:

Animate the 4-panel vertical 9:16 storyboard sheet as one continuous 15-second vertical mixed-media scene, following Panel 1 through Panel 4 in order without showing any panel borders. Preserve the low-drain-level suspense and the feeling of a real back-alley crisis in a small Malaysian warung. The environment stays photographic/3D with wet concrete, real oil shine, practical fluorescent light, real kitchen props, and a handheld lens feel, while Kit and the vendor remain 2D comic-textured characters with visible ink outlines, halftone grain, and cel shading.

Action beats, action first with the spoken line right after each action:

1. Only the vendor uncle is in frame, tilting the oil container toward the longkang drain; the dark amber liquid swells at the lip but does not fall, and Kit is completely absent from frame.
2. Kit's voice suddenly shouts from offscreen, “JANGAN!”, and the vendor jolts and freezes mid-tilt in confusion.
3. Kit slides in from the side, catches the container with both hands and pulls it away from the drain just in time, boots scraping the wet floor, and the vendor argues back, “Apa jangan? Minyak lama je.”
4. Kit braces the heavy container against his chest, blocking the drain, and says, “Lama bukan maksud dia sampah.”
5. The vendor gestures around his cramped shop and says, “Habis nak letak mana? Kedai saya kecil.”

Camera: begin extremely low and close to the drain, looking up at only the vendor and the container, hold suspense before revealing Kit, add a small handheld shake when Kit enters and push in slightly as he blocks the drain, then end on a strong two-shot with Kit between the oil and the drain while the vendor argues beside him. Add a tiny oil rainbow ripple on the wet floor and a small curry leaf fluttering near the drain.

---

## Seedance Clip 2: 15-30s - Oil Still Has Value

Inputs:

- Storyboard image 2
- `@kit_ref`
- `@sparron_ref`
- `@drup_ref`

Prompt:

Animate the 4-panel vertical 9:16 storyboard sheet as one continuous 15-second mixed-media scene, following the panels in order without showing borders. Keep the real environment photographic/3D with wet concrete, real oil sheen, and a practical warung setting, while Kit, Sparron, Dr.UP, and the vendor remain 2D comic-textured characters with ink outlines, halftone grain, and cel shading. Preserve the feeling of a practical rescue and a serious but still playful conversation about the value of used oil.

Action beats, action first with the spoken line right after each action:

1. Kit keeps holding the heavy container away from the drain, visibly strained and determined.
2. Sparron leans in and scans the oil with her green visor, casting a subtle circular glow that forms a clean circle across the surface, and says, “Still usable. No water contamination.”
3. The vendor squints, lost, and asks, “Bahasa biasa boleh?”
4. The scan glow fades softly as Sparron simplifies it for him, “Minyak ni masih boleh collect.”
5. Dr.UP steps in calmly and helps steady the container, then adds, “It is only waste if you waste it.”
6. Kit points toward the proper covered tong and the group slowly shifts the container in that direction as he closes the beat, “Simpan sini. Jangan campur air. Bila penuh, telefon FatHopes.”

Camera: begin from behind Sparron’s visor edge with the green reflection in the foreground, rack focus from the visor glow to the oil surface and finally to the tong, and add a slow lateral move that reveals Dr.UP helping Kit physically. Keep the composition calm and deliberate rather than flashy.

---

## Seedance Clip 3: 30-45s - Another Day, Full Tong

Inputs:

- Storyboard image 3
- optional `@kit_ref`
- optional `@sparron_ref`
- optional `@location_ref`

Prompt:

Animate the 4-panel vertical 9:16 storyboard sheet as one continuous 15-second progress montage, following the panels in order without showing panel borders. Keep the environment photographic/3D and the same warung back alley consistent across the beat, with real wet floor, real metal tong, a real funnel, and true alley shadows. The vendor should remain a 2D comic-textured older Malay uncle with visible ink outlines, subtle halftone grain, and soft cel shading, while any faint memory silhouettes of Kit or Sparron appear as comic-style echoes rather than real people.

Action beats, action first with the spoken line right after the action:

1. The vendor carefully saves used oil into the proper tong through a neatly placed funnel over time, the lid closing cleanly and a visible fill-level mark rising across the sequence, with lunch-rush motion blurring in the background and the pace shifting gently from daytime bustle to evening calm.
2. The vendor stands beside the full covered container holding his phone, a clean oil ring showing he has learned, and says quietly, “Penuh dah. Saya telefon dulu.”

Camera: a slightly elevated wide angle, almost like a surveillance view of the alley, with gentle time-lapse match cuts and a subtle sense of passing time, ending on a slow push toward the dark edge of the alley behind the tong. Keep the tone grounded and rewarding, not flashy. Let the final beat imply that something is about to change, but do not reveal Glinciro yet.

---

## Seedance Clip 4: 45-60s - Glinciro Appears With G.O.M. Vial

Inputs:

- Storyboard image 4
- `@glinciro_ref`
- optional `@location_ref`

Prompt:

Animate the 4-panel vertical 9:16 storyboard sheet as one continuous 15-second villain reveal, following the panels in order without showing any borders. Keep the real alley photographic/3D with warm fluorescent shop light and deep shadow, while Glinciro and the vendor remain 2D comic-textured characters with ink outlines, halftone grain, and cel shading. Preserve the low Dutch-angle composition from behind the full tong so the container feels like the target and the tension stays grounded in a small, intimate alley.

Action beats, action first with the spoken line right after each action:

1. The vendor stands beside the full tong with his phone in hand. From the dark alley edge, Glinciro’s hat appears first, then his half-shadowed face; he steps forward slowly but remains partially in darkness, looking at the full tong with quiet admiration, and says, “Banyak tu minyak.”
2. The vendor tenses and asks, “Kau siapa?”
3. Glinciro tips his hat, staying half in shadow, and says, “Uncle simpan elok. Bagus.”
4. He reveals a tiny black vial marked subtly with G.O.M.; it hisses and the black oily liquid crawls upward inside it against gravity, a creepy but grounded visual, and the vendor pulls the tong closer protectively and warns, “Jangan sentuh. Itu saya punya.”
5. Glinciro tilts the vial near the tong but does not pour yet, and answers, “Saya tak ambil.”
6. Then, almost casually, he adds, “Saya cuma kacau sikit.”

Camera: begin low behind the tong in a Dutch angle, slowly dolly toward the hat silhouette, then rack focus to the vial so the full tong remains large in the foreground as the object of threat. Keep the motion eerie but believable: the black liquid crawling upward against gravity is the visual hook, not magic or spectacle.

---

## Seedance Clip 5: 60-75s - Kit Blocks The Contaminant

Inputs:

- Storyboard image 5
- `@kit_ref`
- `@sparron_ref`
- `@glinciro_ref`
- optional `@drup_ref` if the tool allows extra character reference

Prompt:

Animate the 4-panel vertical 9:16 storyboard sheet as a 15-second climax, following the panels in order without showing any borders. Keep the real alley photographic/3D with wet concrete, a real metal tong lid, steam, and believable shadows, while the characters remain 2D comic-textured with ink outlines, halftone grain, cel highlights, and expressive poses. Preserve the dynamic diagonal action triangle from the storyboard so the scene feels active and readable in a vertical frame.

Action beats, action first with the spoken line right after each action:

1. Glinciro flicks one crawling black drop from the G.O.M. vial toward the full tong and says, “Satu titik cukup.”
2. Kit lunges in and blocks it with the metal lid like a practical shield; the drop hits the lid and sizzles with a small black splatter and steam, but the oil itself remains protected and clean.
3. The vendor, shaken, asks, “Kenapa kau buat macam ni?”
4. Glinciro steps backward into the dark with a controlled smile and explains, “Sebab kalau uncle hilang percaya, minyak ni balik jadi masalah.”
5. Kit, annoyed at the extra work, holds the lid in place and snaps, “Oi. Kacau kari boleh. Minyak jangan.”
6. Sparron scans the contaminant with her green visor, focused and serious, and reports, “Foreign contaminant detected.” Dr.UP stands with the vendor, realizing the attack is really an attack on trust, and the heroes hold the line around the protected tong.

Camera: a dynamic diagonal angle, slightly above and to the side, tracking the black drop’s path at first, then snapping to Kit’s lid block and settling into a clear action triangle with Glinciro left and dark, Kit center, and Sparron right. Keep the motion bold but grounded: one tiny black drop creates an oversized comic reaction on the lid, with steam and a strong impact pose from Kit.
