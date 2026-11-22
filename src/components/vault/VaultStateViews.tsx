import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Text } from "../Text";
import "./vaultDetail.css";

export function LoadingView() {
  return (
    <div className="vault-detail-container">
      <div
        data-testid="vault-detail-loading"
        className="vault-loading-skeleton"
      />
    </div>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="vault-empty-state">
      <Text role="title" as="h2" className="vault-empty-state__title">
        {title}
      </Text>
      <div className="vault-empty-state__body">{children}</div>
      <Link to="/vaults" className="vault-empty-state__link">
        ← Back to Vaults
      </Link>
    </div>
  );
}

export function InvalidIdView({ id }: { id: string }) {
  return (
    <EmptyState title="Invalid vault identifier">
      <Text role="body" as="p" className="vault-empty-state__text">
        The vault ID &quot;{id}&quot; is not a valid identifier and could not be
        used.
      </Text>
      <Text role="caption" as="p" className="vault-empty-state__text">
        Check the link you followed and try again.
      </Text>
    </EmptyState>
  );
}

export function NotFoundView({ id }: { id: string }) {
  return (
    <EmptyState title="Vault not found">
      <Text role="body" as="p" className="vault-empty-state__text">
        No vault with ID &quot;{id}&quot; exists.
      </Text>
    </EmptyState>
  );
}

export function MalformedView({
  issues,
  onRetry,
}: {
  issues: string[];
  onRetry: () => void;
}) {
  return (
    <EmptyState title="Vault data could not be verified">
      <div role="alert" className="vault-empty-state__alert">
        The vault response failed validation and its state was not rendered.
        {issues.length > 0 && (
          <ul className="vault-empty-state__issues">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="vault-btn vault-btn--mt"
      >
        Retry
      </button>
    </EmptyState>
  );
}

export function ErrorView({
  id,
  onRetry,
}: {
  id: string;
  onRetry: () => void;
}) {
  return (
    <EmptyState title="Failed to load vault">
      <Text role="body" as="p" className="vault-empty-state__text">
        Vault &quot;{id}&quot; could not be loaded right now.
      </Text>
      <button type="button" onClick={onRetry} className="vault-btn">
        Retry
      </button>
    </EmptyState>
  );
}
