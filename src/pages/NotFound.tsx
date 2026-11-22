import { Link } from 'react-router-dom'
import { Text } from '../components/Text'
import { AlertCircle, Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 200px)',
        padding: 'var(--spacing-8)',
        textAlign: 'center',
      }}
    >
      {/* Icon */}
      <div
        style={{
          marginBottom: 'var(--spacing-6)',
          padding: 'var(--spacing-6)',
          borderRadius: 'var(--radius-xl)',
          backgroundColor: 'var(--accent-transparent)',
        }}
      >
        <AlertCircle
          size={64}
          style={{
            color: 'var(--accent)',
          }}
        />
      </div>

      {/* 404 Heading */}
      <Text
        role="display"
        as="h1"
        style={{
          marginBottom: 'var(--spacing-4)',
          color: 'var(--text)',
        }}
      >
        404
      </Text>

      {/* Message */}
      <Text
        role="title"
        as="h2"
        style={{
          marginBottom: 'var(--spacing-3)',
          color: 'var(--text)',
        }}
      >
        Page Not Found
      </Text>

      <Text
        role="body"
        as="p"
        style={{
          marginBottom: 'var(--spacing-8)',
          color: 'var(--muted)',
          maxWidth: '480px',
        }}
      >
        The page you're looking for doesn't exist or has been moved. Let's get you back on track.
      </Text>

      {/* Action Buttons */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--spacing-4)',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <Link
          to="/"
          className="notfound-action notfound-action--primary"
        >
          <Home size={18} />
          Go to Home
        </Link>

        <button
          onClick={() => window.history.back()}
          className="notfound-action notfound-action--secondary"
        >
          <ArrowLeft size={18} />
          Go Back
        </button>
      </div>

      {/* Helpful Links */}
      <div
        style={{
          marginTop: 'var(--spacing-8)',
          paddingTop: 'var(--spacing-6)',
          borderTop: '1px solid var(--border)',
        }}
      >
        <Text
          role="caption"
          as="p"
          style={{
            marginBottom: 'var(--spacing-3)',
            color: 'var(--muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontWeight: 600,
          }}
        >
          Popular Pages
        </Text>
        <div
          style={{
            display: 'flex',
            gap: 'var(--spacing-6)',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <Link
            to="/dashboard"
            style={{
              color: 'var(--accent)',
              textDecoration: 'none',
              fontSize: 'var(--font-size-body)',
            }}
          >
            Dashboard
          </Link>
          <Link
            to="/vaults"
            style={{
              color: 'var(--accent)',
              textDecoration: 'none',
              fontSize: 'var(--font-size-body)',
            }}
          >
            Vaults
          </Link>
          <Link
            to="/verifier"
            style={{
              color: 'var(--accent)',
              textDecoration: 'none',
              fontSize: 'var(--font-size-body)',
            }}
          >
            Verifier
          </Link>
        </div>
      </div>
    </div>
  )
}
