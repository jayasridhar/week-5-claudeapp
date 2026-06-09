export default function TypingIndicator() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 'var(--space-3)' }}>
      <div
        style={{
          padding: 'var(--space-3) var(--space-5)',
          borderRadius: 'var(--radius-xl) var(--radius-xl) var(--radius-xl) var(--radius-xs)',
          backgroundColor: 'var(--surface-card)',
          border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          gap: 4,
          alignItems: 'center',
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: 'var(--text-muted)',
              animation: `typing-bounce 1.2s ease-in-out infinite`,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
        <style>{`
          @keyframes typing-bounce {
            0%, 60%, 100% { transform: translateY(0); }
            30% { transform: translateY(-4px); }
          }
        `}</style>
      </div>
    </div>
  )
}
