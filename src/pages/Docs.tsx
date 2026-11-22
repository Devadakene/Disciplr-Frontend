import { Link } from "react-router-dom";
import { Text } from "../components/Text";

const API = (import.meta.env?.VITE_API as string | undefined)?.replace(/\/api\/?$/, "") || "https://disciplr-api.vercel.app";

const card = { padding: "16px 20px", border: "1px solid var(--border, #8883)", borderRadius: 12, margin: "12px 0" } as const;

/** In-app documentation: concept, walkthrough, API and setup. */
export default function Docs() {
  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "var(--spacing-4)" }}>
      <Text role="title" as="h1">Documentation</Text>
      <p style={{ color: "var(--muted)" }}>
        Disciplr turns a commitment into a vault: lock USDC against milestones, let a verifier confirm progress, and
        funds release to your success destination or redirect to a failure destination you chose in advance.
      </p>

      <h2>How it works</h2>
      <ol>
        <li><b>Connect</b> a Freighter wallet on Stellar testnet, or choose the built-in <i>Demo account</i> (no wallet needed).</li>
        <li><b>Create a vault</b> at <Link to="/vaults/create">Create Vault</Link>: amount, deadline, milestones, and the success and failure destination addresses.</li>
        <li><b>Validate milestones</b> from the vault page. When every milestone is validated the vault completes and funds release to the success address.</li>
        <li><b>Cancel or miss</b> the commitment and funds redirect to the failure address.</li>
      </ol>

      <h2>Pages</h2>
      <div style={card}><Link to="/dashboard">Dashboard</Link>: totals, upcoming deadlines, at-risk vaults, recent activity.</div>
      <div style={card}><Link to="/vaults">Vaults</Link>: every vault with status filters. Open one for milestones, timeline and actions.</div>
      <div style={card}><Link to="/transactions">Transactions</Link>: create, validate, release and redirect events.</div>
      <div style={card}><Link to="/verifier">Verifier</Link>: queue and history for people validating other people's milestones.</div>
      <div style={card}><Link to="/analytics">Analytics</Link>: charts across vaults. <Link to="/help">Help</Link>: FAQs and search.</div>

      <h2>API</h2>
      <p>The app talks to the public Disciplr API (<code>VITE_API</code>). Browse it at <a href={API} target="_blank" rel="noopener noreferrer">{API}</a>, or fetch the <a href={`${API}/api/openapi.json`} target="_blank" rel="noopener noreferrer">OpenAPI spec</a>.</p>
      <pre style={{ overflow: "auto", padding: 12, borderRadius: 8, background: "#00000020" }}>{`curl ${API}/api/vaults\ncurl ${API}/api/stats`}</pre>

      <h2>Run locally</h2>
      <pre style={{ overflow: "auto", padding: 12, borderRadius: 8, background: "#00000020" }}>{`npm install\nVITE_API=${API}/api npm run dev`}</pre>
      <p>Without <code>VITE_API</code> the app runs offline on bundled sample data.</p>

      <h2>Demo limitations</h2>
      <p>This deployment is a testnet demo. Vault settlement is simulated by the API (no real funds move), and the demo account makes you your own verifier so you can walk through the full flow alone.</p>
    </div>
  );
}
