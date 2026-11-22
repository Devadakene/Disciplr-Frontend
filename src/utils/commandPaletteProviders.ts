import type { Vault } from "../types/vault";
import { formatUsdc } from "./format";
import type { PaletteItem } from "./commandPalette";

const NAVIGATION_COMMANDS: PaletteItem[] = [
  {
    id: "action-dashboard",
    label: "Dashboard",
    description: "View vault summary and stats",
    to: "/dashboard",
    group: "Navigation",
    keywords: ["home", "stats", "summary"],
  },
  {
    id: "action-vaults",
    label: "Vaults",
    description: "Browse all vaults",
    to: "/vaults",
    group: "Navigation",
    keywords: ["browse", "list", "all"],
  },
  {
    id: "action-create-vault",
    label: "Create Vault",
    description: "Start a new vault",
    to: "/vaults/create",
    group: "Actions",
    keywords: ["new", "start", "cv"],
  },
  {
    id: "action-verifier-queue",
    label: "Verifier Queue",
    description: "Review pending validations",
    to: "/verifier/queue",
    group: "Navigation",
    keywords: ["validations", "pending", "review"],
  },
  {
    id: "action-verifier-history",
    label: "Verifier History",
    description: "View completed verifications",
    to: "/verifier/history",
    group: "Navigation",
    keywords: ["validations", "history", "past", "completed"],
  },
  {
    id: "action-analytics",
    label: "Analytics",
    description: "Open vault analytics",
    to: "/analytics",
    group: "Navigation",
    keywords: ["stats", "metrics", "charts"],
  },
  {
    id: "action-transactions",
    label: "Transactions",
    description: "View transaction activity",
    to: "/transactions",
    group: "Navigation",
    keywords: ["history", "activity", "txs", "tx"],
  },
  {
    id: "action-notifications",
    label: "Notifications",
    description: "View alerts and notifications",
    to: "/notifications",
    group: "Navigation",
    keywords: ["alerts", "updates"],
  },
  {
    id: "action-notification-settings",
    label: "Notification Settings",
    description: "Configure notification preferences",
    to: "/notifications/settings",
    group: "Navigation",
    keywords: ["alerts", "preferences", "config", "settings"],
  },
  {
    id: "action-help",
    label: "Help",
    description: "Open the help center",
    to: "/help",
    group: "Navigation",
    keywords: ["support", "faq", "help center"],
  },
  {
    id: "action-docs",
    label: "Docs",
    description: "View documentation",
    to: "/docs",
    group: "Navigation",
    keywords: ["documentation", "guide", "api"],
  },
];

export function getNavigationCommands(): PaletteItem[] {
  return NAVIGATION_COMMANDS.map((item) => ({
    ...item,
    keywords: item.keywords ? [...item.keywords] : undefined,
  }));
}

export function getActionCommands(toggleTheme?: () => void): PaletteItem[] {
  const actions: PaletteItem[] = [];
  if (toggleTheme) {
    actions.push({
      id: "action-theme-toggle",
      label: "Toggle Theme",
      description: "Switch between light, dark, and system themes",
      group: "Actions",
      keywords: ["dark", "light", "mode", "color", "theme", "appearance"],
      perform: toggleTheme,
    });
  }

  actions.push({
    id: "action-shortcuts-help",
    label: "Keyboard Shortcuts",
    description: "Show all keyboard shortcuts",
    group: "Actions",
    keywords: ["hotkeys", "shortcuts", "keybindings", "keys"],
    perform: () => {
      window.dispatchEvent(new CustomEvent("disciplr:open-shortcuts"));
    },
  });
  return actions;
}

export function getVaultCommands(vaults: Vault[]): PaletteItem[] {
  return vaults.map((vault) => ({
    id: `vault-${vault.id}`,
    label: vault.name,
    description: `Vault ${vault.id} · ${formatUsdc(vault.amount)} ${vault.currency}`,
    to: `/vaults/${vault.id}`,
    group: "Vaults",
    kind: "vault",
    keywords: [vault.id, `${vault.amount}`, vault.currency],
  }));
}
