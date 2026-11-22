import { Text } from "../Text";
import "./vaultDetail.css";

export interface InfoRowProps {
  label: string;
  value: string;
}

export function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="vault-info-row">
      <Text role="caption" as="span" className="vault-info-row__label">
        {label}
      </Text>
      <Text role="caption" as="span" className="vault-info-row__value">
        {value}
      </Text>
    </div>
  );
}
