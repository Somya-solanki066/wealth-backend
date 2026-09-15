import {
  chargeAiCredits,
  creditErrorBody,
  finalizeAiCredits,
  refundAiCredits,
  type ChargeFailure,
  type CreditReservation,
} from "./aiCredits.service";
import type { AiToolId } from "../utils/aiFeatureInventory";

export type MeteredAiResult<T> = {
  result: T;
  reservation: CreditReservation;
  creditsCharged: number;
};

/**
 * Charge credits → run AI work → finalize ledger (refund on throw).
 */
export async function runMeteredAi<T>(opts: {
  userId: string;
  toolId: AiToolId | string;
  operation?: string;
  inputChars?: number;
  workspaceId?: string | null;
  execute: () => Promise<{
    data: T;
    provider?: string;
    model?: string;
    promptTokens?: number;
    completionTokens?: number;
    imageUnits?: number;
  }>;
}): Promise<{ ok: true; value: MeteredAiResult<T> } | { ok: false; failure: ChargeFailure }> {
  const charged = await chargeAiCredits({
    userId: opts.userId,
    toolId: opts.toolId,
    operation: opts.operation,
    inputChars: opts.inputChars,
    workspaceId: opts.workspaceId,
  });

  if (!charged.ok) {
    return { ok: false, failure: charged };
  }

  try {
    const exec = await opts.execute();
    await finalizeAiCredits({
      requestId: charged.reservation.requestId,
      userId: opts.userId,
      status: "success",
      provider: exec.provider || "openai",
      model: exec.model,
      promptTokens: exec.promptTokens,
      completionTokens: exec.completionTokens,
      imageUnits: exec.imageUnits,
    });
    return {
      ok: true,
      value: {
        result: exec.data,
        reservation: charged.reservation,
        creditsCharged: charged.featureCreditCost,
      },
    };
  } catch (err: any) {
    await refundAiCredits({
      requestId: charged.reservation.requestId,
      userId: opts.userId,
      reason: err?.message || "execute_failed",
    });
    throw err;
  }
}

export { creditErrorBody };
