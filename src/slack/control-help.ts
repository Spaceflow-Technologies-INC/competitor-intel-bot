import type { CompetitorCategory, SlackMessage } from "../types.js";
import { actions, button, fields, header, section } from "./blocks.js";

type SlackControlResponse = SlackMessage & {
  response_type: "ephemeral" | "in_channel";
  replace_original?: boolean;
};

export const competitorCategories: CompetitorCategory[] = [
  "procurement_ai",
  "sourcing_automation",
  "supplier_intelligence",
  "erp_procurement",
  "workflow_agent",
  "adjacent"
];

const commandGroups: Array<[string, string[]]> = [
  [
    "View intel",
    [
      "/competitor list",
      "/competitor show coupa.com",
      '/competitor ask coupa.com "How do they use AI?"'
    ]
  ],
  [
    "Add competitors",
    [
      '/competitor add "Acme Sourcing"',
      "/competitor add https://www.linkedin.com/company/acme-sourcing/",
      "/competitor add coupa.com Coupa procurement_ai"
    ]
  ],
  [
    "Approvals",
    [
      "/competitor suggest newco.ai NewCo procurement_ai",
      "/competitor approve newco.ai",
      "/competitor reject newco.ai"
    ]
  ],
  [
    "Operations",
    [
      "/competitor schedule 08:30",
      "/competitor archive coupa.com",
      "/competitor delete coupa.com",
      "/competitor run now"
    ]
  ]
];

export function renderHelp(prefix?: string): SlackControlResponse {
  const blocks = [
    header("Competitor Intel control"),
    section([prefix, "Manage monitoring from Slack without code changes."].filter(Boolean).join("\n\n")),
    fields(commandGroups.map(([label, commands]) => [label, commands.map((command) => `\`${command}\``).join("\n")])),
    section(`*Categories*\n${competitorCategories.map((category) => `\`${category}\``).join("  ")}`),
    defaultActions()
  ];
  return {
    response_type: "ephemeral",
    text: [prefix, "Competitor Intel commands", ...commandGroups.flatMap(([, commands]) => commands), `Categories: ${competitorCategories.join(", ")}`]
      .filter(Boolean)
      .join("\n"),
    blocks
  };
}

export function isCompetitorCategory(value: string): value is CompetitorCategory {
  return competitorCategories.includes(value as CompetitorCategory);
}

export function defaultActions(): Record<string, unknown> {
  return actions([button("List competitors", "intel_list", "list"), button("Run scan", "intel_run_now", "run now", "primary")]);
}
