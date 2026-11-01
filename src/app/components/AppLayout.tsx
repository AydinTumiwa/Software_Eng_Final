import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Bell, FlaskConical, LogOut, Menu, Settings } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from './ui/sheet';
import { MobileNav } from './MobileNav';
import { toast } from 'sonner';
import { ThemeToggle } from './ThemeToggle';
import { APP_NAME, ROLE_LABELS } from '@shared/config';
import type { Notification } from '@shared/types';
import { useAuth, useUser } from '../auth/AuthContext';
import { api } from '../api/client';
import { NAV_SECTIONS, isVisible } from '../navigation';
import { formatTimestamp, initials } from '../utils/format';

const NOTIFICATION_POLL_MS = 60_000;

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, can } = useAuth();
  const user = useUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const load = () => api.notifications.list().then(setNotifications).catch(() => undefined);
    load();
    const timer = setInterval(load, NOTIFICATION_POLL_MS);
    return () => clearInterval(timer);
  }, [location.pathname]);

  const handleNotificationClick = (notification: Notification) => {
    setNotificationOpen(false);
    setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)));
    api.notifications.markRead(notification.id).catch(() => undefined);
    if (notification.link) navigate(notification.link);
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    api.notifications.markRead().catch(() => undefined);
  };

  const handleLogout = async () => {
    await logout();
    toast.success('Signed out');
    navigate('/login', { replace: true });
  };

  const sections = NAV_SECTIONS.map((s) => ({ ...s, items: s.items.filter((i) => isVisible(i, can)) })).filter(
    (s) => s.items.length,
  );
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const navButton = (path: string, label: string, icon: React.ReactNode, onItemClick?: () => void) => {
    const isActive = location.pathname === path;
    return (
      <button
        key={path}
        onClick={() => {
          navigate(path);
          onItemClick?.();
        }}
        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap ${
          isActive ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'
        }`}
      >
        {icon}
        <span className="truncate">{label}</span>
      </button>
    );
  };

  const NavLinks = ({ onItemClick }: { onItemClick?: () => void }) => (
    <div className="space-y-4">
      {sections.map((section, index) => (
        <nav key={index} className="space-y-1">
          {section.title && (
            <p className="px-4 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{section.title}</p>
          )}
          {section.items.map((item) => navButton(item.path, item.label, <item.icon className="h-5 w-5" />, onItemClick))}
        </nav>
      ))}

      <div className="border-t pt-3 space-y-1">
        {navButton('/app/profile', 'Profile & password', <Settings className="h-5 w-5" />, onItemClick)}
        <button
          onClick={() => {
            handleLogout();
            onItemClick?.();
          }}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap text-destructive hover:bg-destructive/10"
        >
          <LogOut className="h-5 w-5" />
          <span className="truncate">Sign out</span>
        </button>
      </div>
    </div>
  );

  const Logo = () => (
    <span className="flex items-center gap-2 whitespace-nowrap text-lg sm:text-xl font-bold text-primary">
      <FlaskConical className="h-6 w-6" />
      {APP_NAME}
    </span>
  );

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 isolate">
        <div className="flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4">
            {/* Mobile Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="sm" aria-label="Open menu">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 overflow-y-auto">
                <div className="flex h-16 items-center px-6 border-b">
                  <SheetTitle asChild>
                    <div>
                      <Logo />
                    </div>
                  </SheetTitle>
                </div>
                <div className="p-4">
                  <NavLinks onItemClick={() => setMobileMenuOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>

            <button onClick={() => navigate('/app/dashboard')}>
              <Logo />
            </button>
          </div>

          {/* Right side */}
          <div className="relative z-10 flex items-center gap-2">
            <ThemeToggle />
            <DropdownMenu open={notificationOpen} onOpenChange={setNotificationOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="relative" aria-label="Notifications">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-destructive text-white text-xs flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <h3 className="font-semibold text-base">Notifications</h3>
                  {unreadCount > 0 && (
                    <Button variant="link" size="sm" className="h-auto p-0 text-sm" onClick={markAllRead}>
                      Mark all read
                    </Button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-muted-foreground">
                      <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No notifications</p>
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleNotificationClick(notification)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            handleNotificationClick(notification);
                          }
                        }}
                        className={`px-4 py-3 border-b hover:bg-muted cursor-pointer ${!notification.isRead ? 'bg-primary/5' : ''}`}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <h4 className="text-sm font-medium">{notification.title}</h4>
                          {!notification.isRead && <div className="h-2 w-2 rounded-full bg-primary mt-1 shrink-0" />}
                        </div>
                        <p className="text-sm text-muted-foreground">{notification.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">{formatTimestamp(notification.createdAt)}</p>
                      </div>
                    ))
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" className="gap-2" onClick={() => navigate('/app/profile')}>
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground">{initials(user.name)}</AvatarFallback>
              </Avatar>
              <span className="hidden md:flex flex-col items-start leading-tight">
                <span className="text-sm">{user.name}</span>
                <span className="text-xs text-muted-foreground font-normal">{ROLE_LABELS[user.role]}</span>
              </span>
            </Button>
          </div>
        </div>
      </header>

      {/* The page is rendered once; the sidebar is hidden on phones. */}
      <div className="md:flex">
        <aside className="hidden md:block w-64 shrink-0 border-r bg-card sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="p-4">
            <NavLinks />
          </div>
        </aside>
        <main className="flex-1 min-w-0 p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
