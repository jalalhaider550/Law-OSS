interface ErrorStateProps {
  message?: string
  onRetry?: () => void
}

export default function ErrorState({
  message = 'Something went wrong',
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '48px 24px',
        fontFamily: 'Inter, -apple-system, sans-serif',
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#7f1d1d', marginBottom: 6 }}>
        {message}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            background: '#fff',
            color: '#1a2e6e',
            border: '1px solid #1a2e6e',
            borderRadius: 8,
            padding: '8px 20px',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            marginTop: 12,
            fontFamily: 'inherit',
          }}
        >
          Try Again
        </button>
      )}
    </div>
  )
}
