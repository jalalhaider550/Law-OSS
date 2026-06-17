'use client'

/**
 * Animated Law OSS logo loader — used wherever we show loading/processing states.
 * Pulses the logo with a soft breathing animation, like Claude's orb.
 */
export default function LogoLoader({ label }: { label?: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 14,
    }}>
      <div style={{ position: 'relative', width: 48, height: 48 }}>
        {/* Outer pulse ring */}
        <div style={{
          position: 'absolute', inset: -6,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.06)',
          animation: 'logoRingPulse 2s ease-in-out infinite',
        }} />
        {/* Inner pulse ring */}
        <div style={{
          position: 'absolute', inset: -2,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.08)',
          animation: 'logoRingPulse 2s ease-in-out infinite 0.3s',
        }} />
        {/* Logo */}
        <img
          src="/logo.png"
          alt="Law OSS"
          width={48}
          height={48}
          style={{
            objectFit: 'contain',
            borderRadius: 10,
            position: 'relative',
            zIndex: 1,
            animation: 'logoBreathe 2s ease-in-out infinite',
          }}
        />
      </div>
      {label && (
        <span style={{ fontSize: 13, color: '#888', fontWeight: 500 }}>{label}</span>
      )}
      <style>{`
        @keyframes logoBreathe {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(0.92); }
        }
        @keyframes logoRingPulse {
          0%, 100% { opacity: 0; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </div>
  )
}
