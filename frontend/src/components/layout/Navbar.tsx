import { Bell, Moon, Sun, Menu } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useState, useEffect } from 'react'

interface NavbarProps {
  title:           string
  onMobileMenuToggle?: () => void
}

export function Navbar({ title, onMobileMenuToggle }: NavbarProps) {
  const { user } = useAuth()
  const [darkMode, setDarkMode] = useState(() =>
    localStorage.getItem('theme') === 'dark'
  )

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [darkMode])

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-3">
        {/* Mobile menu toggle */}
        <button
          className="lg:hidden p-1 rounded text-gray-500 hover:bg-gray-100"
          onClick={onMobileMenuToggle}
        >
          <Menu size={20} />
        </button>
        <h1 className="text-base font-semibold text-gray-800">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Dark mode toggle */}
        <button
          onClick={() => setDarkMode(d => !d)}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          title="Toggle dark mode"
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
          <Bell size={18} />
          {/* Unread badge */}
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full" />
        </button>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-sm font-semibold ml-1">
          {user?.first_name?.[0] ?? user?.username?.[0]?.toUpperCase() ?? 'U'}
        </div>
      </div>
    </header>
  )
}
