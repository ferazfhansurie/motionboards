Sync all fal.ai model definitions in src/lib/models.ts with their actual API schemas.

Steps:
1. Run the sync script: `node scripts/sync-fal-models.mjs`
2. Review the output for mismatches (marked with ❌) and deprecated endpoints (marked with ⚠️)
3. For each mismatch, update the corresponding model entry in src/lib/models.ts:
   - REMOVE: Delete inputs that don't exist in the API
   - ADD: Add missing inputs from the API
   - FIX: Correct required/type mismatches
4. For deprecated endpoints (⚠️), update the model ID to the correct endpoint from the available list
5. After fixes, update the API route (src/app/api/generate/route.ts) if input mapping needs changes:
   - Array params (name ends with `_urls` or `_images`): send as array, not single value
   - End frame params (name contains `end`): map from endFrame reference
6. Run `npx next build` to verify no type errors
7. Commit and push the changes

The sync script fetches each model's OpenAPI spec from `https://fal.run/{base_app}/openapi.json` and compares against local definitions.
