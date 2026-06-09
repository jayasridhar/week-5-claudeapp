export default function ContractUploadBanner({
  onFileSelect,
  uploading = false,
}: {
  onFileSelect: (file: File) => void
  uploading?: boolean
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFileSelect(file)
    e.target.value = ''
  }

  return (
    <div
      style={{
        margin: 'var(--space-5) var(--space-7)',
        padding: 'var(--space-6)',
        borderRadius: 'var(--radius-lg)',
        border: '1.5px dashed var(--border-strong)',
        backgroundColor: 'var(--surface-sunken)',
        textAlign: 'center',
      }}
    >
      <p className="lg-eyebrow" style={{ marginBottom: 'var(--space-2)' }}>
        Contract · Required
      </p>
      <p className="lg-body" style={{ marginBottom: 'var(--space-5)' }}>
        Upload a contract to start the conversation. PDF and TXT files are supported.
      </p>
      <label
        style={{
          display: 'inline-block',
          padding: '10px 20px',
          backgroundColor: 'var(--brand-primary)',
          color: 'var(--text-on-primary)',
          borderRadius: 'var(--radius-md)',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-sm)',
          fontWeight: 500,
          cursor: uploading ? 'not-allowed' : 'pointer',
          opacity: uploading ? 0.6 : 1,
          transition: 'var(--transition-control)',
        }}
      >
        {uploading ? 'Parsing…' : 'Choose file'}
        <input
          type="file"
          accept=".pdf,.txt,text/plain,application/pdf"
          onChange={handleChange}
          style={{ display: 'none' }}
          disabled={uploading}
        />
      </label>
    </div>
  )
}
