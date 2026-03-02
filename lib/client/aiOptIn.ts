const AI_OPT_IN_KEY = "odysseus_ai_opt_in_v1";
const AI_TERMS_ACCEPTED_KEY = "odysseus_ai_terms_accepted_v1";

export function getAiOptIn(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(AI_OPT_IN_KEY) === "true";
  } catch {
    return false;
  }
}

export function setAiOptIn(value: boolean): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(AI_OPT_IN_KEY, value ? "true" : "false");
  } catch {
    // Ignore storage write failures in restricted environments.
  }
}

export function getAiTermsAccepted(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const accepted = window.localStorage.getItem(AI_TERMS_ACCEPTED_KEY);
    if (accepted === "true") {
      return true;
    }

    // Migration path: legacy opt-in implies terms were accepted.
    return window.localStorage.getItem(AI_OPT_IN_KEY) === "true";
  } catch {
    return false;
  }
}

export function setAiTermsAccepted(value: boolean): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(AI_TERMS_ACCEPTED_KEY, value ? "true" : "false");
  } catch {
    // Ignore storage write failures in restricted environments.
  }
}
