import { useOptionalTheme } from "../context/ThemeContext";
import { useCommandPalette } from "../hooks/useCommandPalette";
import type { Vault } from "../types/vault";
import CommandPaletteShell from "./commandPalette/CommandPaletteShell";

interface CommandPaletteProps {
  loadVaults?: () => Promise<Vault[]>;
}

export default function CommandPalette({ loadVaults }: CommandPaletteProps) {
  const theme = useOptionalTheme();
  const palette = useCommandPalette({
    loadVaults,
    toggleTheme: theme?.toggleTheme,
  });

  return <CommandPaletteShell palette={palette} />;
}
