import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  ActivityIndicator,
  Alert,
  AccessibilityInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, borderRadius, shadow } from '../src/theme';
import { useVoiceCapture } from '../src/hooks/useVoiceCapture';
import { useMemoryStore } from '../src/store/memoryStore';
import { MemoryDraft, MemoryType, Horizon } from '@lighthouse/shared';

// ─── Quick-capture templates ─────────────────────────────────────────────────
const TEMPLATES = [
  { label: 'Appointment', prefix: "I have an appointment" },
  { label: 'Family news', prefix: "Family news:" },
  { label: 'Routine', prefix: "My routine:" },
  { label: 'Quick note', prefix: '' },
] as const;

// ─── Memory type display ──────────────────────────────────────────────────────
const TYPE_LABELS: Record<MemoryType, string> = {
  Event: 'Appointment / Event',
  Routine: 'Routine',
  LifeMemory: 'Life Memory',
  QuickNote: 'Quick Note',
  Person: 'Person',
};

const HORIZON_LABELS: Record<Horizon, string> = {
  Today: 'Today',
  ThisWeek: 'This Week',
  Always: 'Always',
};

const TYPE_COLORS: Record<MemoryType, string> = {
  Event: colors.sections.today,
  Routine: colors.sections.thisWeek,
  LifeMemory: colors.sections.remember,
  QuickNote: colors.fog[500],
  Person: '#059669',
};

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function CaptureScreen() {
  const [mode, setMode] = useState<'voice' | 'text'>('voice');
  const [textInput, setTextInput] = useState('');
  const [draft, setDraft] = useState<MemoryDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { recordingState, transcript, isStubMode, startRecording, stopRecording, reset } = useVoiceCapture();
  const { classify, confirmMemory, isClassifying } = useMemoryStore();

  // Amber pulse animation on the mic button while recording
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (recordingState === 'recording') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.12, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
  }, [recordingState, pulseAnim]);

  // ── Voice mic tap handler ──
  const handleMicTap = async () => {
    if (recordingState === 'idle') {
      await startRecording();
    } else if (recordingState === 'recording') {
      const finalTranscript = await stopRecording();
      if (finalTranscript.trim()) {
        await handleClassify(finalTranscript);
      }
    }
  };

  // ── Classify content → show confirmation card ──
  const handleClassify = async (content: string) => {
    try {
      const result = await classify(content);
      setDraft(result);
    } catch {
      Alert.alert('Error', 'Could not classify memory. Please try again.');
    }
  };

  // ── Text submit ──
  const handleTextSubmit = async () => {
    if (!textInput.trim()) return;
    await handleClassify(textInput.trim());
  };

  // ── Confirm and save ──
  const handleConfirm = async () => {
    if (!draft) return;
    setIsSaving(true);
    try {
      await confirmMemory(draft);
      // Amber confirmation pulse + haptic
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      AccessibilityInfo.announceForAccessibility('Memory saved successfully.');
      router.back();
    } catch {
      Alert.alert('Error', 'Could not save memory. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Edit — go back to capture with content pre-filled ──
  const handleEdit = () => {
    if (draft) {
      setTextInput(draft.content);
      setMode('text');
      setDraft(null);
      reset();
    }
  };

  // ── If we have a draft, show confirmation card ──
  if (draft) {
    return <ConfirmationCard
      draft={draft}
      onConfirm={handleConfirm}
      onEdit={handleEdit}
      isSaving={isSaving}
    />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Mode tabs */}
      <View style={styles.modeTabs}>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'voice' && styles.modeTabActive]}
          onPress={() => { setMode('voice'); reset(); }}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'voice' }}
        >
          <Text style={[styles.modeTabText, mode === 'voice' && styles.modeTabTextActive]}>
            Voice
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'text' && styles.modeTabActive]}
          onPress={() => setMode('text')}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'text' }}
        >
          <Text style={[styles.modeTabText, mode === 'text' && styles.modeTabTextActive]}>
            Type
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {mode === 'voice' ? (
          <VoiceCapture
            recordingState={recordingState}
            transcript={transcript}
            isStubMode={isStubMode}
            pulseAnim={pulseAnim}
            isClassifying={isClassifying}
            onMicTap={handleMicTap}
          />
        ) : (
          <TextCapture
            value={textInput}
            onChange={setTextInput}
            onSubmit={handleTextSubmit}
            isClassifying={isClassifying}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Voice Capture Panel ──────────────────────────────────────────────────────
function VoiceCapture({
  recordingState,
  transcript,
  isStubMode,
  pulseAnim,
  isClassifying,
  onMicTap,
}: {
  recordingState: 'idle' | 'recording' | 'processing';
  transcript: string;
  isStubMode: boolean;
  pulseAnim: Animated.Value;
  isClassifying: boolean;
  onMicTap: () => void;
}) {
  const isActive = recordingState === 'recording';
  const isLoading = recordingState === 'processing' || isClassifying;

  return (
    <View style={styles.voicePanel}>
      {isStubMode && (
        <View style={styles.stubBanner}>
          <Text style={styles.stubBannerText}>
            Demo mode — tap mic to cycle through sample memories
          </Text>
        </View>
      )}
      <Text style={styles.instruction}>
        {isActive
          ? 'Listening… tap again to stop'
          : isLoading
          ? 'Processing your memory…'
          : 'Tap the microphone to record a memory'}
      </Text>

      {/* Mic button — large, easy to tap, pulsing amber when active */}
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <TouchableOpacity
          style={[styles.micButton, isActive && styles.micButtonActive]}
          onPress={onMicTap}
          disabled={isLoading}
          accessibilityLabel={isActive ? 'Stop recording' : 'Start recording'}
          accessibilityRole="button"
          accessibilityHint={isActive ? 'Double tap to stop recording' : 'Double tap to start recording voice memory'}
        >
          {isLoading ? (
            <ActivityIndicator size="large" color={colors.text.inverse} />
          ) : (
            <Text style={styles.micIcon}>{isActive ? '⏹' : '🎙'}</Text>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Live transcript display */}
      {(transcript.length > 0 || isActive) && (
        <View style={styles.transcriptBox}>
          <Text style={styles.transcriptLabel}>What I heard:</Text>
          <Text style={styles.transcriptText}>
            {transcript || 'Listening…'}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Text Capture Panel ───────────────────────────────────────────────────────
function TextCapture({
  value,
  onChange,
  onSubmit,
  isClassifying,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  isClassifying: boolean;
}) {
  return (
    <View style={styles.textPanel}>
      <Text style={styles.instruction}>What would you like to remember?</Text>

      {/* Quick-capture templates */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.templateScroll}
        contentContainerStyle={styles.templateRow}
      >
        {TEMPLATES.map((t) => (
          <TouchableOpacity
            key={t.label}
            style={styles.templateChip}
            onPress={() => onChange(t.prefix ? `${t.prefix} ` : '')}
            accessibilityLabel={`Template: ${t.label}`}
          >
            <Text style={styles.templateChipText}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Large-font text input — PRD: min 18pt, high contrast */}
      <TextInput
        style={styles.textInput}
        value={value}
        onChangeText={onChange}
        placeholder="Start typing your memory…"
        placeholderTextColor={colors.text.tertiary}
        multiline
        autoFocus
        accessibilityLabel="Memory text input"
        accessibilityHint="Type your memory here"
        returnKeyType="done"
      />

      <TouchableOpacity
        style={[styles.submitButton, (!value.trim() || isClassifying) && styles.submitButtonDisabled]}
        onPress={onSubmit}
        disabled={!value.trim() || isClassifying}
        accessibilityLabel="Save memory"
        accessibilityRole="button"
      >
        {isClassifying ? (
          <ActivityIndicator color={colors.text.inverse} />
        ) : (
          <Text style={styles.submitButtonText}>Review Memory</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── Confirmation Card ────────────────────────────────────────────────────────
function ConfirmationCard({
  draft,
  onConfirm,
  onEdit,
  isSaving,
}: {
  draft: MemoryDraft;
  onConfirm: () => void;
  onEdit: () => void;
  isSaving: boolean;
}) {
  // Amber glow animation on mount
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(glowAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [glowAnim]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.confirmScroll}>
        <Animated.View style={[styles.confirmGlow, { opacity: glowAnim }]} />

        <Text style={styles.confirmHeading}>I captured this memory:</Text>

        <View style={styles.confirmCard}>
          {/* Type + Horizon badges */}
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: TYPE_COLORS[draft.type] + '22' }]}>
              <Text style={[styles.badgeText, { color: TYPE_COLORS[draft.type] }]}>
                {TYPE_LABELS[draft.type]}
              </Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{HORIZON_LABELS[draft.horizon]}</Text>
            </View>
          </View>

          {/* Summary */}
          <Text style={styles.confirmSummary}>{draft.summary}</Text>

          {/* Original content (smaller, secondary) */}
          <Text style={styles.confirmOriginal}>{draft.content}</Text>
        </View>

        <Text style={styles.confirmQuestion}>Is this right?</Text>

        <View style={styles.confirmActions}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={onEdit}
            accessibilityLabel="Edit memory"
            accessibilityRole="button"
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.confirmButton, isSaving && styles.confirmButtonDisabled]}
            onPress={onConfirm}
            disabled={isSaving}
            accessibilityLabel="Confirm and save memory"
            accessibilityRole="button"
          >
            {isSaving ? (
              <ActivityIndicator color={colors.text.inverse} />
            ) : (
              <Text style={styles.confirmButtonText}>Save Memory</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Mode tabs
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modeTab: {
    flex: 1,
    paddingVertical: spacing[3],
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: colors.transparent,
  },
  modeTabActive: {
    borderBottomColor: colors.amber.DEFAULT,
  },
  modeTabText: {
    ...typography.label,
    color: colors.text.secondary,
  },
  modeTabTextActive: {
    color: colors.amber.dark,
    fontWeight: '700',
  },

  scroll: {
    flexGrow: 1,
    padding: spacing[5],
    paddingBottom: spacing[12],
  },

  instruction: {
    ...typography.bodyLarge,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing[8],
  },

  stubBanner: {
    backgroundColor: colors.sand[100],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.sand.DEFAULT,
  },
  stubBannerText: {
    ...typography.label,
    color: colors.text.secondary,
    textAlign: 'center',
  },

  // Voice
  voicePanel: {
    alignItems: 'center',
    paddingTop: spacing[8],
  },
  micButton: {
    width: 130,
    height: 130,
    borderRadius: borderRadius.full,
    backgroundColor: colors.amber.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.lg,
    shadowColor: colors.amber.dark,
  },
  micButtonActive: {
    backgroundColor: colors.amber.dark,
  },
  micIcon: {
    fontSize: 52,
  },
  transcriptBox: {
    marginTop: spacing[8],
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
  },
  transcriptLabel: {
    ...typography.label,
    color: colors.text.tertiary,
    marginBottom: spacing[2],
  },
  transcriptText: {
    ...typography.bodyLarge,
    color: colors.text.primary,
    lineHeight: 28,
  },

  // Text
  textPanel: {
    flex: 1,
  },
  templateScroll: {
    marginBottom: spacing[4],
  },
  templateRow: {
    gap: spacing[2],
    paddingRight: spacing[5],
  },
  templateChip: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    backgroundColor: colors.sand[100],
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.sand.DEFAULT,
  },
  templateChipText: {
    ...typography.label,
    color: colors.text.secondary,
  },
  textInput: {
    ...typography.bodyLarge,
    color: colors.text.primary,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
    minHeight: 140,
    textAlignVertical: 'top',
    marginBottom: spacing[4],
  },
  submitButton: {
    backgroundColor: colors.amber.DEFAULT,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    alignItems: 'center',
    ...shadow.sm,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    ...typography.bodyLarge,
    color: colors.text.inverse,
    fontWeight: '700',
  },

  // Confirmation card
  confirmScroll: {
    flexGrow: 1,
    padding: spacing[5],
    paddingBottom: spacing[12],
  },
  confirmGlow: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: colors.amber.light,
    opacity: 0.4,
  },
  confirmHeading: {
    ...typography.heading,
    color: colors.text.primary,
    marginBottom: spacing[5],
    marginTop: spacing[4],
  },
  confirmCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing[5],
    ...shadow.md,
    marginBottom: spacing[6],
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  badge: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    backgroundColor: colors.fog[100],
    borderRadius: borderRadius.full,
  },
  badgeText: {
    ...typography.label,
    color: colors.text.secondary,
    fontSize: 13,
  },
  confirmSummary: {
    ...typography.bodyLarge,
    color: colors.text.primary,
    marginBottom: spacing[3],
    lineHeight: 28,
  },
  confirmOriginal: {
    ...typography.body,
    color: colors.text.tertiary,
    fontStyle: 'italic',
  },
  confirmQuestion: {
    ...typography.title,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing[6],
  },
  confirmActions: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  editButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  editButtonText: {
    ...typography.bodyLarge,
    color: colors.text.primary,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 2,
    backgroundColor: colors.amber.DEFAULT,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    alignItems: 'center',
    ...shadow.md,
    shadowColor: colors.amber.dark,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    ...typography.bodyLarge,
    color: colors.text.inverse,
    fontWeight: '700',
  },
});
