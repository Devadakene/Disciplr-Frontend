import { Text } from "../Text";
import type { VaultActionAuth } from "../../utils/vaultState";
import "./vaultDetail.css";

export interface ActionButtonProps {
  label: string;
  color: string;
  auth: VaultActionAuth;
  disabled?: boolean;
  onClick: () => void;
}

export function ActionButton({
  label,
  color,
  auth,
  disabled = false,
  onClick,
}: ActionButtonProps) {
  const isDisabled = !auth.allowed || disabled;

  return (
    <span className="vault-action-button">
      <button
        type="button"
        className={isDisabled ? "vault-btn vault-btn--disabled" : "vault-btn"}
        style={{ borderColor: color, color }}
        onClick={onClick}
        disabled={isDisabled}
        aria-disabled={isDisabled}
      >
        {label}
      </button>
      {!auth.allowed && auth.reasons.length > 0 && (
        <Text role="caption" as="span" className="vault-action-button__reason">
          {auth.reasons[0]}
        </Text>
      )}
    </span>
  );
}
