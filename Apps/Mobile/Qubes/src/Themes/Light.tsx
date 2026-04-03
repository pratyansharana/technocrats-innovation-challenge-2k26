export const lightTheme = {
  colors: {
    primary: '#2ecc71',
    secondary: '#3498db',
    background: '#F9FBFC',
    surface: '#FFFFFF',
    text: '#2C3E50',
    textSecondary: '#7F8C8D',
    border: '#E0E6ED',
    error: '#E74C3C',
    success: '#27AE60',
    accent: '#F1C40F',
    cardShadow: 'rgba(0, 0, 0, 0.05)',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 4,
    md: 10,
    lg: 20,
    round: 50,
  }
};

export type AppTheme = typeof lightTheme;