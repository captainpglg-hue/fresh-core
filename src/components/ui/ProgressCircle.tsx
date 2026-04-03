import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors } from '../../constants/colors';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  percent: number;
  size?: number;
  color?: string;
  label?: string;
}

export function ProgressCircle({
  percent,
  size = 120,
  color = Colors.primary,
  label,
}: Props) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const strokeWidth = size * 0.08;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const clampedPercent = Math.max(0, Math.min(100, percent));

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: clampedPercent,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [clampedPercent, animatedValue]);

  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });

  return (
    <View style={styles.container}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={Colors.border}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <AnimatedCircle
            cx={center}
            cy={center}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={strokeDashoffset}
            transform={`rotate(-90 ${center} ${center})`}
          />
        </Svg>
        <View style={[styles.labelContainer, { width: size, height: size }]}>
          <Text style={[styles.percentText, { fontSize: size * 0.24, color }]}>
            {Math.round(clampedPercent)}%
          </Text>
        </View>
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  labelContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentText: {
    fontWeight: '700',
  },
  label: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
