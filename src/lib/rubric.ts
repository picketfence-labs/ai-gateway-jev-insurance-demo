export const INTAKE_RUBRIC = {
  version: "insurance-intake-v2",
  desk: {
    instructions: "Choose a fictional information desk using the current projected record state and the inquiry together, not the case ID or a keyword alone. When an inquiry is vague, use the exposed lifecycle context or ask for clarification. Do not infer authority, eligibility, rejection reasons, or bank receipt.",
    criteria: {
      claim_progress: "Claim record state, including pending or rejected status; no rejection reason is provided",
      application_status: "Application record status and presence of a resulting-policy reference, not policy validity",
      payment_status: "Recorded paid amount or payment-status questions; paid status does not prove bank receipt",
      policy_information: "Only projected policy/product information, without a coverage or eligibility decision",
      general_intake: "Clarify an ambiguous topic when the projected state and inquiry do not determine an appropriate desk",
    },
  },
  priority: {
    instructions: "Score the need for additional clarification using only current projected facts and the unverified inquiry, not urgency or a wish for early contact. A reported difference is not a verified contradiction. Requested and paid amounts may differ legitimately; that difference alone is not an error. Null paid amount means unrecorded, not zero. Paid status and reported bank receipt are different fields. Do not invent dates, documents, itemization, rejection causes, payment eligibility, or policy validity.",
    criteria: [
      "0: exposed records support a narrow explanation of the queried field and no same-field disagreement is reported",
      "1: a detail is not projected or a limited confirmation is needed, without an explicit dispute of the same recorded field or value",
      "2: the user explicitly disputes the same projected field or value and a human should compare that unresolved reported difference; not a verified error or urgency",
    ],
  },
  nextCheck: {
    instructions: "Recommend a next question using the projected record state and the inquiry together. If a recorded field is disputed, recommend checking that field; if an unexposed detail is requested, ask for confirmation without inventing it. A paid claim with unconfirmed bank arrival calls for a receipt check, not a verified discrepancy. Recommendations are not findings or Jev internal reasons.",
    criteria: {
      claim_progress: "Claim record state, including pending or rejected status; no rejection reason is provided",
      claim_additional_information: "Claim additional information",
      application_progress: "Application progress",
      application_correction: "Application correction",
      payment_receipt: "Payment receipt",
      payment_amount: "Payment amount",
      policy_information: "Only projected policy/product information, without a coverage or eligibility decision",
      clarify_intent: "Clarify intent",
    },
  },
} as const;
