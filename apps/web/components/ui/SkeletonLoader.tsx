export default function SkeletonLoader({ rows = 3 }: { rows?: number }) {
  return (
    <div style={{ padding: '16px 0' }}>
      <style>{`@keyframes sk-pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ marginBottom: 12 }}>
          <div
            style={{
              height: 14,
              background: '#f0f0f0',
              borderRadius: 6,
              width: `${60 + (i * 13) % 35}%`,
              animation: 'sk-pulse 1.5s ease-in-out infinite',
              animationDelay: `${i * 0.1}s`,
            }}
          />
        </div>
      ))}
    </div>
  )
}
