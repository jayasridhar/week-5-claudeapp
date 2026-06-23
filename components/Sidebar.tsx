'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { BarChart2, CreditCard, LogOut } from 'lucide-react'

export default function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    setUserEmail(localStorage.getItem('userEmail') ?? '')
  }, [])

  function handleLogout() {
    localStorage.removeItem('userId')
    localStorage.removeItem('userEmail')
    localStorage.removeItem('financial_output')
    router.replace('/login')
  }

  const navItems = [
    { href: '/dashboard/financial', label: 'Financial Analysis', icon: BarChart2 },
    { href: '/dashboard/credit',    label: 'Credit Readiness',   icon: CreditCard },
  ]

  return (
    <aside className="w-64 flex-shrink-0 bg-an-bg-subtle border-r border-an-border flex flex-col h-full">
      {/* Logo area */}
      <div className="p-4 pb-3 flex-shrink-0 border-b border-an-border">
        <span className="font-display text-[15px] font-semibold text-an-fg-base">Paarizaat Portal</span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 p-3 flex flex-col gap-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2.5 h-9 px-3 rounded text-body-sm transition-colors duration-100 ${
              pathname === href || pathname.startsWith(href + '/')
                ? 'bg-an-bg-elevated text-an-fg-base'
                : 'text-an-fg-subtle hover:bg-an-bg-surface hover:text-an-fg-base'
            }`}
          >
            <Icon size={14} strokeWidth={1.5} />
            {label}
          </Link>
        ))}
      </nav>

      {/* User footer */}
      <div className="flex-shrink-0 border-t border-an-border p-3 flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-an-accent-subtle flex items-center justify-center flex-shrink-0">
          <span className="text-caption font-medium text-an-accent">
            {userEmail.charAt(0).toUpperCase()}
          </span>
        </div>
        <span className="flex-1 min-w-0 text-body-sm text-an-fg-subtle truncate">{userEmail}</span>
        <button
          onClick={handleLogout}
          title="Log out"
          className="p-1 rounded text-an-fg-muted hover:text-an-fg-base hover:bg-an-bg-surface transition-colors duration-100"
        >
          <LogOut size={14} strokeWidth={1.5} />
        </button>
      </div>
    </aside>
  )
}
