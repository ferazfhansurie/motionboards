Check a specific model's definition against its actual fal.ai API schema.

The user provides a model ID like "fal-ai/minimax/speech-02-hd". $ARGUMENTS contains the model ID.

Steps:
1. Read the model's current definition from src/lib/models.ts
2. Fetch the actual API schema:
   - Split model ID: base app = first 2 path segments, endpoint = rest
   - Run: `curl -s -H "Authorization: Key $FAL_KEY" "https://fal.run/{base_app}/openapi.json"`
   - Parse the JSON and find the POST endpoint matching the model path
   - Extract input schema (properties, required, types, enums, defaults)
3. Also fetch the model page for latest info:
   - Use WebFetch on `https://fal.ai/models/{model_id}/api`
   - Extract full input/output schema details
4. Compare our definition vs API reality:
   - Check each input: name, type, required matches?
   - Check for missing inputs we should add
   - Check for inputs we have that don't exist in the API
   - Check options (aspect_ratio, duration, etc.) match API enums
5. Report findings and fix any mismatches in src/lib/models.ts
6. If input names changed, also update mapping in src/app/api/generate/route.ts
7. Build and verify with `npx next build`
