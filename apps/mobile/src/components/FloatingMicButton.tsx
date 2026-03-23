import React, { useRef, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, borderRadius, shadow } from '../theme';

/**
 * Always-visible floating microphone button.
 * PRD VC-01: "Always-visible floating microphone button on all screens"
 *
 * Positioned above the tab bar so it's reachable from any tab.
 * Gentle breathing animation at idle to invite interaction.
 */
export function FloatingMicButton() {
  const breatheAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, { toValue: 1.05, duration: 1800, useNativeDriver: true }),
        Animated.timing(breatheAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, [breatheAnim]);

  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/capture');
  };

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <Animated.View style={{ transform: [{ scale: breatheAnim }] }}>
        <TouchableOpacity
          style={styles.button}
          onPress={handlePress}
          accessibilityLabel="Capture a new memory"
          accessibilityRole="button"
          accessibilityHint="Double tap to open memory capture"
        >
          <Text style={styles.icon}>🎙</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 96, // above the 80pt tab bar
    alignSelf: 'center',
    zIndex: 100,
  },
  button: {
    width: 68,
    height: 68,
    borderRadius: borderRadius.full,
    backgroundColor: colors.amber.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.lg,
    shadowColor: colors.amber.dark,
  },
  icon: {
    fontSize: 30,
  },
});
