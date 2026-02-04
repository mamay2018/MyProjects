import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ActivityIndicator,
  ViewStyle,
  TextStyle 
} from 'react-native';
import { COLORS, SPACING, FONTS } from '../constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
}) => {
  const getButtonStyle = (): ViewStyle => {
    const base: ViewStyle = {
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
    };

    // Size styles
    switch (size) {
      case 'sm':
        base.paddingVertical = SPACING.sm;
        base.paddingHorizontal = SPACING.md;
        break;
      case 'lg':
        base.paddingVertical = SPACING.md + 4;
        base.paddingHorizontal = SPACING.xl;
        break;
      default:
        base.paddingVertical = SPACING.md;
        base.paddingHorizontal = SPACING.lg;
    }

    // Variant styles
    switch (variant) {
      case 'secondary':
        base.backgroundColor = COLORS.secondary;
        break;
      case 'outline':
        base.backgroundColor = 'transparent';
        base.borderWidth = 2;
        base.borderColor = COLORS.primary;
        break;
      case 'ghost':
        base.backgroundColor = 'transparent';
        break;
      default:
        base.backgroundColor = COLORS.primary;
    }

    if (disabled) {
      base.opacity = 0.5;
    }

    return base;
  };

  const getTextStyle = (): TextStyle => {
    const base: TextStyle = {
      fontWeight: '600',
    };

    switch (size) {
      case 'sm':
        base.fontSize = FONTS.sizes.sm;
        break;
      case 'lg':
        base.fontSize = FONTS.sizes.lg;
        break;
      default:
        base.fontSize = FONTS.sizes.md;
    }

    switch (variant) {
      case 'outline':
      case 'ghost':
        base.color = COLORS.primary;
        break;
      default:
        base.color = '#FFFFFF';
    }

    return base;
  };

  return (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator 
          color={variant === 'outline' || variant === 'ghost' ? COLORS.primary : '#FFFFFF'} 
          size="small" 
        />
      ) : (
        <>
          {icon}
          <Text style={[getTextStyle(), icon && { marginLeft: SPACING.sm }, textStyle]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};
