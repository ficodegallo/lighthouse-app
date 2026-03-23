import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { colors, typography, spacing } from '../../src/theme';
import { api } from '../../src/services/api';
import { Briefing } from '@lighthouse/shared';

const SECTION_COLORS: Record<string, string> = {
  Today: colors.sections.today,
  'This Week': colors.sections.thisWeek,
  Remember: colors.sections.remember,
};

export default function BriefingScreen() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Audio player state
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [speechRate, setSpeechRate] = useState(1.0);

  useEffect(() => {
    loadTodaysBriefing();
    return () => {
      // Cleanup audio on unmount
      soundRef.current?.unloadAsync();
    };
  }, []);

  const loadTodaysBriefing = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.briefings.today();
      setBriefing(result);
    } catch {
      setError('no_briefing');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const result = await api.briefings.generate();
      setBriefing(result);
    } catch (err) {
      Alert.alert('Could not generate briefing', (err as Error).message);
    } finally {
      setIsGenerating(false);
    }
  }, []);

  // Audio playback
  const handlePlayPause = useCallback(async () => {
    if (!briefing?.audioUrl) return;

    if (soundRef.current) {
      const status = await soundRef.current.getStatusAsync();
      if (status.isLoaded) {
        if (status.isPlaying) {
          await soundRef.current.pauseAsync();
          setIsPlaying(false);
        } else {
          await soundRef.current.playAsync();
          setIsPlaying(true);
        }
        return;
      }
    }

    // Load and play fresh
    setIsAudioLoading(true);
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: briefing.audioUrl },
        { shouldPlay: true, rate: speechRate, shouldCorrectPitch: true },
        onPlaybackStatusUpdate
      );
      soundRef.current = sound;
      setIsPlaying(true);
      // Track engagement
      api.briefings.trackAudioPlayed(briefing.id).catch(() => {});
    } catch {
      Alert.alert('Could not play audio', 'The audio briefing could not be loaded.');
    } finally {
      setIsAudioLoading(false);
    }
  }, [briefing, speechRate]);

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    setPlaybackPosition(status.positionMillis);
    setPlaybackDuration(status.durationMillis ?? 0);
    if (status.didJustFinish) {
      setIsPlaying(false);
      setPlaybackPosition(0);
    }
  }, []);

  const handleSpeedChange = useCallback(async () => {
    const speeds = [0.75, 0.85, 1.0, 1.25];
    const next = speeds[(speeds.indexOf(speechRate) + 1) % speeds.length];
    setSpeechRate(next);
    if (soundRef.current) {
      const status = await soundRef.current.getStatusAsync();
      if (status.isLoaded) {
        await soundRef.current.setRateAsync(next, true);
      }
    }
  }, [speechRate]);

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Amber glow */}
      <View style={styles.glow} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Morning Briefing</Text>
        <Text style={styles.date}>{dateStr}</Text>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.amber.DEFAULT} />
            <Text style={styles.loadingText}>Loading your briefing...</Text>
          </View>
        ) : error === 'no_briefing' ? (
          <NoBriefingState onGenerate={handleGenerate} isGenerating={isGenerating} />
        ) : briefing ? (
          <>
            {/* Audio player */}
            {briefing.audioUrl && (
              <AudioPlayer
                isPlaying={isPlaying}
                isLoading={isAudioLoading}
                position={playbackPosition}
                duration={playbackDuration}
                speechRate={speechRate}
                onPlayPause={handlePlayPause}
                onSpeedChange={handleSpeedChange}
              />
            )}

            {/* Briefing sections */}
            {briefing.sections?.map((section) => (
              <View key={section.title} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View
                    style={[
                      styles.sectionDot,
                      { backgroundColor: SECTION_COLORS[section.title] ?? colors.amber.DEFAULT },
                    ]}
                  />
                  <Text
                    style={[
                      styles.sectionTitle,
                      { color: SECTION_COLORS[section.title] ?? colors.amber.DEFAULT },
                    ]}
                  >
                    {section.title}
                  </Text>
                </View>
                <Text style={styles.sectionContent}>{section.content}</Text>
              </View>
            ))}

            {/* Regenerate button */}
            <TouchableOpacity
              style={styles.regenerateBtn}
              onPress={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <ActivityIndicator size="small" color={colors.text.tertiary} />
              ) : (
                <Text style={styles.regenerateBtnText}>Regenerate briefing</Text>
              )}
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function AudioPlayer({
  isPlaying,
  isLoading,
  position,
  duration,
  speechRate,
  onPlayPause,
  onSpeedChange,
}: {
  isPlaying: boolean;
  isLoading: boolean;
  position: number;
  duration: number;
  speechRate: number;
  onPlayPause: () => void;
  onSpeedChange: () => void;
}) {
  const progress = duration > 0 ? position / duration : 0;
  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  return (
    <View style={audioStyles.card}>
      <Text style={audioStyles.label}>Listen to your briefing</Text>

      {/* Progress bar */}
      <View style={audioStyles.progressBar}>
        <View style={[audioStyles.progressFill, { width: `${progress * 100}%` as any }]} />
      </View>

      <View style={audioStyles.timeRow}>
        <Text style={audioStyles.time}>{formatTime(position)}</Text>
        <Text style={audioStyles.time}>{formatTime(duration)}</Text>
      </View>

      <View style={audioStyles.controls}>
        {/* Play/Pause */}
        <TouchableOpacity style={audioStyles.playBtn} onPress={onPlayPause} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.text.inverse} />
          ) : (
            <Text style={audioStyles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
          )}
        </TouchableOpacity>

        {/* Speed */}
        <TouchableOpacity style={audioStyles.speedBtn} onPress={onSpeedChange}>
          <Text style={audioStyles.speedText}>{speechRate}x</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function NoBriefingState({
  onGenerate,
  isGenerating,
}: {
  onGenerate: () => void;
  isGenerating: boolean;
}) {
  return (
    <View style={styles.noBriefing}>
      <Text style={styles.noBriefingTitle}>No briefing yet today</Text>
      <Text style={styles.noBriefingText}>
        Your morning briefing is generated at 5 AM each day. Tap below to generate one now.
      </Text>
      <TouchableOpacity
        style={styles.generateBtn}
        onPress={onGenerate}
        disabled={isGenerating}
      >
        {isGenerating ? (
          <View style={styles.generatingRow}>
            <ActivityIndicator size="small" color={colors.text.inverse} />
            <Text style={styles.generateBtnText}>  Generating...</Text>
          </View>
        ) : (
          <Text style={styles.generateBtnText}>Generate my briefing</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  glow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.amber.light,
    opacity: 0.25,
  },
  scroll: {
    padding: spacing[5],
    paddingBottom: spacing[24],
  },
  title: {
    ...typography.heading,
    color: colors.text.primary,
    marginBottom: spacing[1],
  },
  date: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing[5],
  },
  center: {
    paddingVertical: spacing[12],
    alignItems: 'center',
    gap: spacing[4],
  },
  loadingText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing[5],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[3],
    gap: spacing[2],
  },
  sectionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sectionTitle: {
    ...typography.label,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContent: {
    ...typography.bodyLarge,
    color: colors.text.primary,
    lineHeight: 30,
    fontSize: 18,
  },
  noBriefing: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing[6],
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginTop: spacing[4],
  },
  noBriefingTitle: {
    ...typography.title,
    color: colors.text.primary,
    marginBottom: spacing[3],
    textAlign: 'center',
  },
  noBriefingText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: spacing[5],
  },
  generateBtn: {
    backgroundColor: colors.amber.DEFAULT,
    borderRadius: 14,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[8],
  },
  generatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  generateBtnText: {
    ...typography.label,
    color: colors.text.inverse,
    fontWeight: '700',
    fontSize: 16,
  },
  regenerateBtn: {
    alignItems: 'center',
    paddingVertical: spacing[4],
    marginTop: spacing[2],
  },
  regenerateBtnText: {
    ...typography.caption,
    color: colors.text.tertiary,
    fontSize: 13,
  },
});

const audioStyles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFBF0',
    borderRadius: 16,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: colors.amber.light,
    marginBottom: spacing[5],
  },
  label: {
    ...typography.label,
    color: colors.amber.dark,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[3],
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginBottom: spacing[2],
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: colors.amber.DEFAULT,
    borderRadius: 2,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  time: {
    ...typography.caption,
    color: colors.text.tertiary,
    fontSize: 12,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  playBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.amber.DEFAULT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    fontSize: 20,
    color: colors.text.inverse,
  },
  speedBtn: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderWidth: 1,
    borderColor: colors.border,
  },
  speedText: {
    ...typography.label,
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
});
