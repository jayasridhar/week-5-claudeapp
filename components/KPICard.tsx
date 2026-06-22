type Props = {
  label: string
  value: number | string | null
  subLabel?: string
  loading?: boolean
}

export default function KPICard({ label, value, subLabel, loading }: Props) {
  return (
    <div className="bg-an-bg-surface border border-an-border rounded-lg p-4">
      <p className="text-caption text-an-fg-muted mb-2">{label}</p>
      {loading ? (
        <div className="h-8 w-16 bg-an-bg-elevated rounded animate-pulse" />
      ) : (
        <p className="text-[26px] font-semibold font-display text-an-fg-base leading-none">
          {value ?? '--'}
        </p>
      )}
      {subLabel && (
        <p className="text-caption text-an-fg-muted mt-1">{subLabel}</p>
      )}
    </div>
  )
}
