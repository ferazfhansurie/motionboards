// Central pricing logic.
//
// Two layers:
//   1. The user-facing ESTIMATE — shown in the UI before they generate. That
//      lives in src/lib/models.ts on each model's `cost` and `creditCost`
//      fields. It's a quote, not a bill.
//   2. The actual CHARGE — applied AFTER a generation succeeds. That's the
//      provider's real cost (in credits) PLUS the platform markup. This file
//      handles layer 2.
//
// Credits: 1 RM = 100 credits. So 1 credit = RM0.01 = 1 sen.
//
// Markup (the platform's cut, on top of the provider's actual cost):
//   - Image / audio:  +1 credit  (RM 0.01)
//   - Video:          +20 credits (RM 0.20)
//
// Refunds: if a generation fails, no charge is applied (see
// chargeForGeneration call sites — they only fire on success). The pre-flight
// balance check uses the estimate to gate starting a paid call at all.

import { models, type AIModel } from "@/lib/models";

// USD → RM conversion rate. Provider invoices come in USD, charges go out
// in RM. Update once when the FX moves materially. Keep conservative — we'd
// rather over-charge slightly than under-charge.
export const USD_TO_RM = 4.4;

// Markup the platform adds on top of provider cost. In CREDITS (sen).
export const MARKUP_IMAGE_CREDITS = 1;   // RM 0.01 per image / audio gen
export const MARKUP_VIDEO_CREDITS = 20;  // RM 0.20 per video gen

export type GenerationKind = "image" | "video" | "audio";

// Given a model, what kind of generation is it? Drives which markup applies.
export function kindForModel(model: AIModel): GenerationKind {
  if (model.type === "audio") return "audio";
  if (
    model.type === "t2v" ||
    model.type === "i2v" ||
    model.type === "v2v" ||
    model.type === "s2e" ||
    model.category === "Video"
  ) {
    return "video";
  }
  return "image";
}

export function markupCreditsForKind(kind: GenerationKind): number {
  return kind === "video" ? MARKUP_VIDEO_CREDITS : MARKUP_IMAGE_CREDITS;
}

// Provider's actual cost in CREDITS, given a generation context.
//
// Priority order:
//   1. Caller provided `providerCostUsd` (e.g. from response usage / metrics).
//      Convert to credits and return.
//   2. The model has a `perSecond` rate AND we know `durationSec`.
//      Compute `perSecond * duration`.
//   3. Fall back to the model's static `creditCost` from models.ts.
export function providerCostCredits(opts: {
  model: AIModel;
  providerCostUsd?: number;
  durationSec?: number;
  hasAudio?: boolean;
  resolution?: string;
}): number {
  const { model, providerCostUsd, durationSec, hasAudio, resolution } = opts;

  if (typeof providerCostUsd === "number" && providerCostUsd >= 0) {
    return Math.round(providerCostUsd * USD_TO_RM * 100);
  }

  // Per-second video pricing baked into the model definition (RM/sec).
  if (model.perSecond && durationSec && durationSec > 0) {
    const ps = model.perSecond;
    const is4k = !!resolution && /4k/i.test(resolution);
    const audio = !!hasAudio;
    const rmPerSec =
      is4k && audio ? ps.withAudio4k :
      is4k          ? ps.noAudio4k :
      audio         ? ps.withAudio720p :
                      ps.noAudio720p;
    if (rmPerSec > 0) {
      return Math.round(rmPerSec * durationSec * 100);
    }
  }

  // Default: the curated estimate from models.ts. Already in credits.
  return model.creditCost || 0;
}

// The total amount we charge the user for a successful generation.
// Returns each component so the DB can store them separately for audit /
// future refunds.
export function computeCharge(opts: {
  modelId: string;
  providerCostUsd?: number;
  durationSec?: number;
  hasAudio?: boolean;
  resolution?: string;
}): {
  providerCredits: number;
  markupCredits: number;
  totalCredits: number;
  kind: GenerationKind;
} {
  const model = models.find((m) => m.id === opts.modelId);
  if (!model) {
    // Unknown model — best-effort: zero provider cost, image markup so
    // we never silently free-roll. Should never happen in practice.
    return {
      providerCredits: 0,
      markupCredits: MARKUP_IMAGE_CREDITS,
      totalCredits: MARKUP_IMAGE_CREDITS,
      kind: "image",
    };
  }
  const kind = kindForModel(model);
  const providerCredits = providerCostCredits({
    model,
    providerCostUsd: opts.providerCostUsd,
    durationSec: opts.durationSec,
    hasAudio: opts.hasAudio,
    resolution: opts.resolution,
  });
  const markupCredits = markupCreditsForKind(kind);
  return {
    providerCredits,
    markupCredits,
    totalCredits: providerCredits + markupCredits,
    kind,
  };
}

// Estimate displayed BEFORE generation (gates affordability — no deduction).
// This is the quote: provider cost + markup, same formula as the actual
// charge. Without a duration / resolution / providerCostUsd it falls back to
// the model's static creditCost — same as today's UI.
export function estimateChargeForModel(modelId: string, opts?: {
  durationSec?: number;
  hasAudio?: boolean;
  resolution?: string;
}): number {
  return computeCharge({
    modelId,
    durationSec: opts?.durationSec,
    hasAudio: opts?.hasAudio,
    resolution: opts?.resolution,
  }).totalCredits;
}
