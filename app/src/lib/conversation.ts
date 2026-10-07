import type { CaseId } from "./scenarios";
import { ContractError } from "./projection";

export type ConversationTurn = {
  caseId: CaseId;
  mode: "live";
  userText: string;
  assistantText: string;
};

const MAX_TURN_TEXT = 2000;

function validText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= MAX_TURN_TEXT;
}

export function validateConversationHistory(value: unknown, caseId: CaseId, currentInquiry: unknown): ConversationTurn[] {
  if (!validText(currentInquiry)) throw new ContractError("Inquiry must be 1–2000 characters");
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 1) throw new ContractError("History may contain at most one prior completed turn plus the current inquiry");

  const history = value.map((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw new ContractError("Invalid conversation history");
    const turn = candidate as Record<string, unknown>;
    const keys = Object.keys(turn).sort();
    if (keys.join(",") !== "assistantText,caseId,mode,userText" || turn.caseId !== caseId || turn.mode !== "live" || !validText(turn.userText) || !validText(turn.assistantText)) {
      throw new ContractError("Conversation history must be text from one previous live turn in the same case");
    }
    return { caseId, mode: "live" as const, userText: turn.userText, assistantText: turn.assistantText };
  });
  const totalCharacters = currentInquiry.length + history.reduce((total, turn) => total + turn.userText.length + turn.assistantText.length, 0);
  if (totalCharacters > 3 * MAX_TURN_TEXT) throw new ContractError("Conversation history exceeds the 6000-character limit");
  return history;
}

export function serializeConversationContext(history: ConversationTurn[], currentInquiry: string): string {
  return JSON.stringify({
    previous_conversation_only_unverified: history.map(({ userText, assistantText }) => ({ user: userText, assistant: assistantText })),
    current_user_statement: currentInquiry,
  });
}
