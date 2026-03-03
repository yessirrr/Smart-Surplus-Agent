const ODYSSEUS_OPT_IN_KEY = "odysseus_opt_in_v1";
const ODYSSEUS_TERMS_ACCEPTED_KEY = "odysseus_terms_accepted_v1";

export function getOdysseusOptIn(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(ODYSSEUS_OPT_IN_KEY) === "true";
  } catch {
    return false;
  }
}

export function setOdysseusOptIn(value: boolean): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(ODYSSEUS_OPT_IN_KEY, value ? "true" : "false");
  } catch {
    // Ignore storage write failures in restricted environments.
  }
}

export function getOdysseusTermsAccepted(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const accepted = window.localStorage.getItem(ODYSSEUS_TERMS_ACCEPTED_KEY);
    if (accepted === "true") {
      return true;
    }

    // Migration path: legacy opt-in implies terms were accepted.
    return window.localStorage.getItem(ODYSSEUS_OPT_IN_KEY) === "true";
  } catch {
    return false;
  }
}

export function setOdysseusTermsAccepted(value: boolean): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(ODYSSEUS_TERMS_ACCEPTED_KEY, value ? "true" : "false");
  } catch {
    // Ignore storage write failures in restricted environments.
  }
}


