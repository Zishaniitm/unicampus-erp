import { NavLink, useNavigate } from 'react-router-dom'
import { cn } from '@/utils/cn'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'
import {
  LayoutDashboard, Clock, UserCheck, CreditCard, BookOpen,
  Bell, MessageSquare, Settings, LogOut, GraduationCap,
  Users, ClipboardList, BookMarked, Bus, Home, Calendar
} from 'lucide-react'
import type { Role } from '@/types/auth.types'

interface NavItem {
  label: string
  to:    string
  icon:  React.ReactNode
  roles: Role[]
}

const navItems: NavItem[] = [
  { label: 'Dashboard',         to: '/dashboard',      icon: <LayoutDashboard size={18} />, roles: ['SUPER_ADMIN','PRINCIPAL','HOD','TEACHER','STUDENT','ACCOUNT_OFFICER','LIBRARIAN','STAFF','ADMISSION_STAFF','EXAM_CONTROLLER'] },
  { label: 'Timetable',         to: '/timetable',      icon: <Clock size={18} />,           roles: ['STUDENT','TEACHER','HOD'] },
  { label: 'Attendance',        to: '/attendance',     icon: <UserCheck size={18} />,        roles: ['STUDENT'] },
  { label: 'Mark Attendance',   to: '/attendance/mark',icon: <UserCheck size={18} />,        roles: ['TEACHER','HOD'] },
  { label: 'Timetable Mgmt',    to: '/hod/timetable',  icon: <Calendar size={18} />,         roles: ['HOD','SUPER_ADMIN'] },
  { label: 'Batch Attendance',  to: '/hod/attendance', icon: <ClipboardList size={18} />,    roles: ['HOD','PRINCIPAL','SUPER_ADMIN'] },
  { label: 'Fees',              to: '/fees',           icon: <CreditCard size={18} />,       roles: ['STUDENT'] },
  { label: 'Fee Management',    to: '/fees/manage',    icon: <CreditCard size={18} />,       roles: ['ACCOUNT_OFFICER','PRINCIPAL','SUPER_ADMIN'] },
  { label: 'Library',           to: '/library',        icon: <BookOpen size={18} />,         roles: ['STUDENT'] },
  { label: 'Library Mgmt',      to: '/library/manage', icon: <BookOpen size={18} />,         roles: ['LIBRARIAN','SUPER_ADMIN'] },
  { label: 'Hostel',            to: '/hostel',         icon: <Home size={18} />,             roles: ['STUDENT','STAFF'] },
  { label: 'Bus',               to: '/bus',            icon: <Bus size={18} />,              roles: ['STUDENT','STAFF'] },
  { label: 'Notices',           to: '/notices',        icon: <Bell size={18} />,             roles: ['SUPER_ADMIN','PRINCIPAL','HOD','TEACHER','STUDENT','STAFF'] },
  { label: 'Grievances',        to: '/grievances',     icon: <MessageSquare size={18} />,    roles: ['STUDENT'] },
  { label: 'Grievance Queue',   to: '/grievances/queue', icon: <MessageSquare size={18} />,  roles: ['HOD','ACCOUNT_OFFICER','LIBRARIAN','STAFF','PRINCIPAL','SUPER_ADMIN'] },
  { label: 'Students',          to: '/students',       icon: <Users size={18} />,            roles: ['SUPER_ADMIN','HOD','STAFF','ADMISSION_STAFF','TEACHER'] },
  { label: 'Admission',         to: '/admission',      icon: <GraduationCap size={18} />,    roles: ['SUPER_ADMIN','ADMISSION_STAFF'] },
  { label: 'Exams',             to: '/exams',          icon: <ClipboardList size={18} />,    roles: ['EXAM_CONTROLLER','HOD','TEACHER','STUDENT'] },
  { label: 'Placement',         to: '/placement',      icon: <BookMarked size={18} />,       roles: ['SUPER_ADMIN','STAFF','STUDENT','PRINCIPAL'] },
  { label: 'Settings',          to: '/settings',       icon: <Settings size={18} />,         roles: ['SUPER_ADMIN'] },
]

export function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const visibleItems = navItems.filter(item => user?.role && item.roles.includes(user.role))

  async function handleLogout() {
    await logout()
    toast.success('Logged out successfully.')
    navigate('/login')
  }

  return (
    <aside className="h-screen w-60 bg-primary flex flex-col shrink-0 shadow-lg">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
            <GraduationCap size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">UniCampus</p>
            <p className="text-blue-200 text-xs">ERP System</p>
          </div>
        </div>
      </div>

      {/* User info */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-accent-light flex items-center justify-center text-white text-sm font-semibold shrink-0">
            {user?.first_name?.[0] ?? user?.username?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="overflow-hidden">
            <p className="text-white text-sm font-medium truncate">
              {user?.first_name ? `${user.first_name} ${user.last_name ?? ''}` : user?.username}
            </p>
            <p className="text-blue-300 text-xs truncate">{user?.role?.replace(/_/g, ' ')}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <p className="text-blue-300/60 text-xs font-semibold uppercase tracking-wider px-3 mb-2">
          Main Navigation
        </p>
        <ul className="space-y-0.5">
          {visibleItems.map(item => (
            <li key={item.to}>
              <NavLink to={item.to}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150',
                  isActive
                    ? 'bg-white/15 text-white font-medium'
                    : 'text-blue-200 hover:bg-white/10 hover:text-white',
                )}>
                {item.icon}
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-white/10">
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-blue-200 hover:bg-white/10 hover:text-white transition-all">
          <LogOut size={18} />
          Log Out
        </button>
      </div>
    </aside>
  )
}
