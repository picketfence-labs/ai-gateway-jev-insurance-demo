export const INTAKE_RUBRIC = {
  version: "insurance-intake-v1",
  desk: {
    instructions: "Choose the fictional intake desk that best fits the customer's stated inquiry and projected facts. Do not infer authority or eligibility.",
    criteria: {
      claim_progress: "Claim progress",
      application_status: "Application status",
      payment_status: "Payment status",
      policy_information: "Policy information",
      general_intake: "General intake",
    },
  },
  priority: {
    instructions: "Score only the stated intake priority. This is not objective urgency, a deadline, or a service-level promise.",
    criteria: [
      "0: ordinary status or procedure inquiry",
      "1: additional clarification or reported mismatch",
      "2: explicit wish for early human contact",
    ],
  },
  nextCheck: {
    instructions: "Choose a question or next check to recommend. Do not present it as a verified finding or internal reason.",
    criteria: {
      claim_progress: "Claim progress",
      claim_additional_information: "Claim additional information",
      application_progress: "Application progress",
      application_correction: "Application correction",
      payment_receipt: "Payment receipt",
      payment_amount: "Payment amount",
      policy_information: "Policy information",
      clarify_intent: "Clarify intent",
    },
  },
} as const;
