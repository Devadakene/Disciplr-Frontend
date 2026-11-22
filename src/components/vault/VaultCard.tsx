import type { ReactNode } from "react";
import "./vaultDetail.css";

interface VaultCardProps {
  children: ReactNode;
  className?: string;
}

export function VaultCard({ children, className }: VaultCardProps) {
  const classes = className ? `vault-card ${className}` : "vault-card";
  return <div className={classes}>{children}</div>;
}
