Add a new fal.ai model to the app. The user will provide a model ID (e.g. "fal-ai/some-model/endpoint").

Steps:
1. Fetch the model's OpenAPI schema to get the exact input parameters:
   - Split model ID into base app (first 2 segments) and endpoint (rest)
   - Fetch: `curl -s -H "Authorization: Key $FAL_KEY" "https://fal.run/{base_app}/openapi.json"`
   - Find the POST endpoint matching the model's path
   - Extract input schema: properties, required fields, types, descriptions, enums

2. Also fetch the model's fal.ai page for pricing/speed info:
   - Use WebFetch on `https://fal.ai/models/{model_id}/api`
   - Extract: description, pricing per run, estimated speed

3. Determine the model configuration:
   - `type`: Based on inputs/outputs — t2v, i2v, s2e, t2i, i2i, v2v, upscale, lipsync, audio, a2a
   - `category`: Match to existing categories in models.ts
   - `inputs`: Map API params to our format:
     - params with "prompt"/"text" → type: "text"
     - params with "image"/"frame" → type: "image"
     - params with "video" → type: "video"
     - params with "audio" → type: "audio"
     - params ending in "_urls"/"_images" → still map as type: "image" but note array
   - `options`: Map enum params like aspect_ratio, duration, resolution
   - `creditCost`: Calculate from fal.ai price × 370 (USD to RM cents) + margin

4. Add the model entry to the `models` array in src/lib/models.ts in the correct category section

5. If the model needs special input mapping in the API route, update src/app/api/generate/route.ts

6. Run `npx next build` to verify, then commit
