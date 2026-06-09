import AuthForm from '../components/auth/AuthForm'

export default function AuthPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ backgroundColor: 'var(--surface-sunken)' }}
    >
      <AuthForm />
    </div>
  )
}
