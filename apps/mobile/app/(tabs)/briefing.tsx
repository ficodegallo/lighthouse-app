import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../../src/theme';

/**
 * Briefing screen — displays the morning briefing in three sections.
 * Sprint 4: Full implementation with BriefingComposerAgent output + audio player.
 */
export default function BriefingScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.glow} />

        <Text style={styles.title}>Your Morning Briefing</Text>
        <Text style={styles.subtitle}>
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </Text>

        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Your personalized briefing will appear here each morning.
          </Text>
          <Text style={[styles.placeholderText, { marginTop: spacing[3] }]}>
            It will include:
          </Text>
          <Text style={styles.bulletText}>Today's appointments and tasks</Text>
          <Text style={styles.bulletText}>What's coming this week</Text>
          <Text style={styles.bulletText}>A memory just for you</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: spacing[5],
    paddingBottom: spacing[20],
  },
  // Soft radial glow — the lighthouse beam effect
  glow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.amber.light,
    opacity: 0.3,
  },
  title: {
    ...typography.heading,
    color: colors.text.primary,
    marginBottom: spacing[1],
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing[6],
  },
  placeholder: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing[6],
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeholderText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  bulletText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing[2],
    paddingLeft: spacing[3],
  },
});
