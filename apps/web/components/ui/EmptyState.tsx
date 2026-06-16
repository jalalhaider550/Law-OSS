interface EmptyStateProps {
  emoji?: string
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export default function EmptyState({ emoji = '📂', title, description, action }: EmptyStateProps) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '48px 24px',
        color: '#999',
        fontFamily: 'Inter, -apple-system, sans-serif',
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 12 }}>{emoji}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#555', marginBottom: 6 }}>{title}</div>
      {description && (
        <div style={{ fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>{description}</div>
      )}
      {action && (
        <button
          onClick={action.onClick}
          style={{
            background: '#1a2e6e',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '8px 20px',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
