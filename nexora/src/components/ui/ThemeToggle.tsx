import { Moon, Sun } from 'lucide-react';
import { useUi } from '../../store/uiStore';

export function ThemeToggle({ label = false }: { label?: boolean }) {
  const theme = useUi((s) => s.theme);
  const setTheme = useUi((s) => s.setTheme);
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className={`theme-toggle ${theme}`}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      onClick={() => setTheme(next)}
    >
      <span className="theme-swatch dark" aria-hidden="true" />
      <span className="theme-swatch light" aria-hidden="true" />
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      {label ? <span>{theme === 'dark' ? 'Light' : 'Dark'}</span> : null}
    </button>
  );
}
