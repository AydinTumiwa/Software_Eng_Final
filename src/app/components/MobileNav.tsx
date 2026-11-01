import { useNavigate, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { NAV_SECTIONS, isVisible } from '../navigation';

export function MobileNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { can } = useAuth();

  const navItems = NAV_SECTIONS.flatMap((s) => s.items)
    .filter((i) => i.mobile && isVisible(i, can))
    .slice(0, 4);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-50">
      <div className="h-16" style={{ display: 'grid', gridTemplateColumns: `repeat(${navItems.length}, 1fr)` }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
