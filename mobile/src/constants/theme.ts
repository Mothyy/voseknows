const PALETTE = {
    slate50: '#f8fafc',
    slate100: '#f1f5f9',
    slate200: '#e2e8f0',
    slate300: '#cbd5e1',
    slate400: '#94a3b8',
    slate500: '#64748b',
    slate600: '#475569',
    slate700: '#334155',
    slate800: '#1e293b',
    slate900: '#0f172a',
    slate950: '#020617',
    red500: '#ef4444',
    red900: '#450a0a',
    emerald500: '#10b981',
    emerald900: '#064e3b',
};

export const LIGHT_THEME = {
    mode: 'light',
    background: '#ffffff',
    foreground: PALETTE.slate900,
    card: '#ffffff',
    cardForeground: PALETTE.slate900,
    primary: PALETTE.slate900,
    primaryForeground: PALETTE.slate50,
    muted: PALETTE.slate100,
    mutedForeground: PALETTE.slate500,
    border: PALETTE.slate200,
    destructive: PALETTE.red500,
    success: PALETTE.emerald500,
    badgeSuccessBg: '#dcfce7',
    badgeDestructiveBg: '#fee2e2',
};

export const DARK_THEME = {
    mode: 'dark',
    background: PALETTE.slate950,
    foreground: PALETTE.slate50,
    card: PALETTE.slate900,
    cardForeground: PALETTE.slate50,
    primary: PALETTE.slate50,
    primaryForeground: PALETTE.slate900,
    muted: PALETTE.slate800,
    mutedForeground: PALETTE.slate400,
    border: PALETTE.slate800,
    destructive: '#f87171', // lighter red
    success: '#34d399',     // lighter green
    badgeSuccessBg: 'rgba(6, 78, 59, 0.5)',
    badgeDestructiveBg: 'rgba(69, 10, 10, 0.5)',
};

export const SPACING = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
};
