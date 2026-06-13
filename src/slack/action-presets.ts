import { button, type ButtonStyle } from "./blocks.js";

export function askAiButton(domain: string, style: ButtonStyle = "primary"): Record<string, unknown> {
  return button("Ask AI", "intel_ask_ai", `ask ${domain} "How do they use AI in procurement workflows?"`, {
    style,
    accessibilityLabel: `Ask AI about ${domain}`
  });
}

export function showBattlecardButton(domain: string, style?: ButtonStyle): Record<string, unknown> {
  return button("Show battlecard", "intel_show_battlecard", `show ${domain}`, {
    ...(style ? { style } : {}),
    accessibilityLabel: `Show ${domain} battlecard`
  });
}

export function technicalBriefButton(domain: string): Record<string, unknown> {
  return button("Technical brief", "intel_technical_brief", `tech ${domain}`, {
    accessibilityLabel: `Open ${domain} technical brief`
  });
}

export function refreshBriefButton(domain: string, label = "Refresh", style?: ButtonStyle): Record<string, unknown> {
  return button(label, "intel_refresh_technical", `refresh ${domain}`, {
    ...(style ? { style } : {}),
    accessibilityLabel: `Refresh ${domain} technical research`
  });
}

export function evidenceButton(domain: string): Record<string, unknown> {
  return button("Evidence", "intel_evidence", `evidence ${domain}`);
}

export function unknownsButton(domain: string): Record<string, unknown> {
  return button("Unknowns", "intel_unknowns", `unknowns ${domain}`);
}

export function archiveButton(domain: string, actionId = "intel_archive"): Record<string, unknown> {
  return button("Archive", actionId, `archive ${domain}`, {
    confirm: {
      title: "Archive competitor",
      text: `Archive ${domain}? It will stop future scans, but historical intel stays available.`,
      confirm: "Archive"
    }
  });
}

export function rejectCandidateButton(domain: string): Record<string, unknown> {
  return button("Reject", "intel_reject_candidate", `reject ${domain}`, {
    confirm: {
      title: "Reject candidate",
      text: `Reject ${domain}? It will be kept out of active monitoring.`,
      confirm: "Reject"
    }
  });
}

export function deleteButton(domain: string, actionId = "intel_delete"): Record<string, unknown> {
  return button("Delete", actionId, `delete ${domain}`, {
    style: "danger",
    confirm: {
      title: "Delete competitor",
      text: `Delete ${domain}? Source monitoring will be removed and signals will be detached from the active competitor.`,
      confirm: "Delete",
      style: "danger"
    }
  });
}
