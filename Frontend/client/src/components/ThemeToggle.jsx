import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className="flex h-10 w-10 items-center justify-center rounded-lg border transition-all duration-200"
      style={{
        background: isDark ? 'rgb(var(--bg-secondary))' : 'rgb(var(--bg-secondary))',
        borderColor: isDark ? 'rgb(var(--border-primary))' : 'rgb(var(--border-primary))',
        color: isDark ? 'rgb(var(--text-secondary))' : 'rgb(var(--text-secondary))',
      }}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
