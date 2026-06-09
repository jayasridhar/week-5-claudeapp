import Badge from '../ui/Badge'

export default function ContractStatusChip({
  uploaded,
  fileName,
}: {
  uploaded: boolean
  fileName?: string
}) {
  if (!uploaded) return <Badge variant="warning" dot>No contract</Badge>
  return (
    <Badge variant="success" dot>
      {fileName ? `${fileName.slice(0, 20)}…` : 'Contract attached'}
    </Badge>
  )
}
