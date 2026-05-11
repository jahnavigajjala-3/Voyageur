import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  // ALWAYS default to light mode (unless user explicitly changed it)
  const [theme, setTheme] = useState(() => {
    // Only check localStorage - ignore system preference
    const saved = localStorage.getItem('voyageur-theme');
    return saved || 'light'; // Always default to light
  });

  useEffect(() => {
    const root = document.documentElement;
    
    // Remove both attributes first
    root.removeAttribute('data-theme');
    root.classList.remove('dark');
    
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
      root.classList.add('dark');
    }
    
    localStorage.setItem('voyageur-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDarkMode: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

