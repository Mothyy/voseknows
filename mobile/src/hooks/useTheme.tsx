import { useColorScheme } from 'react-native';
import { LIGHT_THEME, DARK_THEME } from '../constants/theme';

export function useTheme() {
    const scheme = useColorScheme();
    return scheme === 'dark' ? DARK_THEME : LIGHT_THEME;
}
