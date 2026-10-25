import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { BookOpen, CalendarClock, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, CreditCard, FileText, GraduationCap, LayoutDashboard, LogOut, Menu, Moon, Search, Settings2, Sun, Users, Wallet, X } from 'lucide-react';
import { useAuth } from './auth-context';
import { cn } from '@/lib/utils';

type NavItem = { label: string; path: string; icon: typeof LayoutDashboard; adminOnly?: boolean };
const navItems: NavItem[] = [
  { label: 'Overview', path: '/', icon: LayoutDashboard },
  { label: 'Courses', path: '/courses', icon: BookOpen },
  { label: 'Quizzes', path: '/quizzes', icon: CircleHelp },
  { label: 'Payments', path: '/payments', icon: CreditCard },
  { label: 'Promo codes', path: '/promo-codes', icon: FileText },
  { label: 'Channels', path: '/channels', icon: Users },
  { label: 'Learners', path: '/learners', icon: GraduationCap },
  { label: 'Scheduled content', path: '/scheduled', icon: CalendarClock },
  { label: 'Payment methods', path: '/payment-methods', icon: Wallet, adminOnly: true },
  { label: 'Users', path: '/users', icon: Settings2, adminOnly: true },
];

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem('hexa-theme') === 'dark');
  const [search, setSearch] = useState('');
  const { user, isSuper, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => { document.documentElement.classList.toggle('dark', dark); }, [dark]);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('hexa-theme', next ? 'dark' : 'light');
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(`/courses?search=${encodeURIComponent(search.trim())}`);
  }

  const visibleLinks = navItems.filter((item) => !item.adminOnly || isSuper);
  const routeTitle = visibleLinks.find((item) => location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path)))?.label ?? 'Course editor';

  return <div className="min-h-screen bg-[#FBFCFC] text-ink dark:bg-slate-950 dark:text-white">
    <aside className={cn('fixed inset-y-0 left-0 z-40 hidden border-r border-line bg-white transition-[width] duration-200 dark:border-slate-800 dark:bg-slate-950 lg:flex lg:flex-col', collapsed ? 'w-[76px]' : 'w-[244px]')}>
      <Brand collapsed={collapsed} />
      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Main navigation">{visibleLinks.map((item) => <NavigationLink key={item.path} item={item} collapsed={collapsed} />)}</nav>
      <div className="border-t border-line p-3 dark:border-slate-800"><button onClick={() => setCollapsed(!collapsed)} className="flex h-9 w-full items-center justify-center rounded-lg text-muted hover:bg-slate-100 hover:text-ink dark:hover:bg-slate-800" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? <ChevronRight className="size-4" /> : <span className="flex items-center gap-2 text-xs"><ChevronLeft className="size-4" />Collapse menu</span>}</button></div>
    </aside>
    {drawerOpen && <div className="fixed inset-0 z-50 bg-slate-950/30 lg:hidden" onClick={() => setDrawerOpen(false)}><aside className="h-full w-[280px] bg-white dark:bg-slate-950" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between pr-3"><Brand collapsed={false} /><button className="rounded-lg p-2 text-muted" aria-label="Close menu" onClick={() => setDrawerOpen(false)}><X className="size-4" /></button></div><nav className="space-y-1 px-3 py-4" aria-label="Main navigation">{visibleLinks.map((item) => <NavigationLink key={item.path} item={item} collapsed={false} onClick={() => setDrawerOpen(false)} />)}</nav></aside></div>}
    <div className={cn('min-h-screen transition-[margin] duration-200', collapsed ? 'lg:ml-[76px]' : 'lg:ml-[244px]')}>
      <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-line bg-white/90 px-4 backdrop-blur md:px-8 dark:border-slate-800 dark:bg-slate-950/90">
        <div className="flex items-center gap-3"><button className="rounded-lg p-2 text-muted hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800" onClick={() => setDrawerOpen(true)} aria-label="Open menu"><Menu className="size-5" /></button><div className="hidden text-sm text-muted sm:block">Admin <span className="mx-2 text-slate-300">/</span> <span className="text-ink dark:text-white">{routeTitle}</span></div></div>
        <div className="flex items-center gap-2 md:gap-4">{location.pathname !== '/quizzes' && <form onSubmit={submitSearch} className="relative hidden sm:block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><label htmlFor="global-search" className="sr-only">Search courses</label><input id="global-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search courses" className="h-9 w-52 rounded-lg border border-line bg-[#FBFCFC] pl-9 pr-3 text-xs outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15 dark:border-slate-700 dark:bg-slate-900" /></form>}<button onClick={toggleTheme} className="rounded-lg p-2 text-muted hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}>{dark ? <Sun className="size-4" /> : <Moon className="size-4" />}</button>
          <DropdownMenu.Root><DropdownMenu.Trigger asChild><button className="flex items-center gap-2 rounded-full border border-line p-1 pr-2.5 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900" aria-label="Open profile menu"><span className="grid size-8 place-items-center rounded-full bg-[#D9EFEB] text-xs font-semibold text-[#0C7466]">{user?.displayName.charAt(0) ?? 'H'}</span><span className="hidden text-left sm:block"><span className="block max-w-32 truncate text-xs font-medium text-ink dark:text-white">{user?.displayName}</span><span className="block text-[10px] text-muted">{isSuper ? 'Super admin' : 'Page admin'}</span></span><ChevronDown className="hidden size-3 text-muted sm:block" /></button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={8} className="z-50 min-w-44 rounded-xl border border-line bg-white p-1 shadow-card dark:border-slate-700 dark:bg-slate-900"><DropdownMenu.Item className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink outline-none hover:bg-slate-50 dark:text-white dark:hover:bg-slate-800"><Users className="size-4 text-muted" />{user?.email ?? 'Admin account'}</DropdownMenu.Item><DropdownMenu.Separator className="my-1 h-px bg-line dark:bg-slate-700" /><DropdownMenu.Item onSelect={() => void logout()} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 outline-none hover:bg-red-50"><LogOut className="size-4" />Sign out</DropdownMenu.Item></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1440px] px-4 py-7 md:px-8 md:py-9"><Outlet /></main>
      <footer className="px-4 pb-6 text-center text-[11px] text-slate-400 md:px-8">Hexa Learn Admin <span className="mx-1">·</span> {new Date().getFullYear()}</footer>
    </div>
  </div>;
}

function Brand({ collapsed }: { collapsed: boolean }) {
  return <div className={cn('flex h-[68px] items-center gap-3 border-b border-line px-5 dark:border-slate-800', collapsed && 'justify-center px-2')}><div className="grid size-9 place-items-center rounded-xl bg-accent text-white"><GraduationCap className="size-5" /></div>{!collapsed && <div><p className="text-[14px] font-semibold tracking-[-0.02em] text-ink dark:text-white">Hexa Learn</p><p className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-muted">Admin console</p></div>}</div>;
}

function NavigationLink({ item, collapsed, onClick }: { item: NavItem; collapsed: boolean; onClick?: () => void }) {
  const Icon = item.icon;
  return <NavLink to={item.path} end={item.path === '/'} onClick={onClick} title={collapsed ? item.label : undefined} className={({ isActive }) => cn('group flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors', isActive ? 'bg-[#E9F5F3] text-[#0B786A] dark:bg-teal-950/60 dark:text-teal-300' : 'text-slate-500 hover:bg-slate-50 hover:text-ink dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white', collapsed && 'justify-center px-0')}><Icon className="size-[17px] shrink-0" strokeWidth={1.8} />{!collapsed && <span>{item.label}</span>}</NavLink>;
}
