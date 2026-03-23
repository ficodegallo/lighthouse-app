import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Briefing } from '@lighthouse/shared';
import { colors, typography, spacing } from '../../src/theme';
import { useMemoryStore } from '../../src/store/memoryStore';
import { api } from '../../src/services/api';

const SUGGESTED_QUESTIONS = [
  "What's happening today?",
  "What do I have this week?",
  "Who is my doctor?",
];

export default function HomeScreen() {
  const greeting = getGreeting();
  const router = useRouter();
  const { memories, fetchMemories } = useMemoryStore();

  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);
  const answerOpacity = useRef(new Animated.Value(0)).current;

  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [briefingChecked, setBriefingChecked] = useState(false);

  // Fetch today's memories and briefing on mount
  useEffect(() => {
    fetchMemories('Today');
    api.briefings.today()
      .then(setBriefing)
      .catch(() => {}) // no briefing yet is fine
      .finally(() => setBriefingChecked(true));
  }, []);

  const todayMemories = memories.filter((m) => m.horizon === 'Today');

  const handleQuery = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    Keyboard.dismiss();
    setQuestion(trimmed);
    setIsQuerying(true);
    setAnswer(null);
    answerOpacity.setValue(0);
    try {
      const result = await api.memories.query(trimmed);
      setAnswer(result.answer);
      Animated.timing(answerOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    } catch {
      setAnswer("I had trouble answering that. Please try again.");
      answerOpacity.setValue(1);
    } finally {
      setIsQuerying(false);
    }
  }, [answerOpacity]);

  const handleClearQuery = () => {
    setQuestion('');
    setAnswer(null);
    answerOpacity.setValue(0);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.date}>{formatDate(new Date())}</Text>
        </View>

        {/* Morning Briefing card */}
        {briefingChecked && (
          <TouchableOpacity
            style={briefing ? styles.briefingCard : styles.briefingCardEmpty}
            onPress={() => router.push('/(tabs)/briefing')}
            activeOpacity={0.85}
          >
            <View style={styles.briefingCardInner}>
              <Text style={styles.briefingCardLabel}>
                {briefing ? 'Morning Briefing' : 'Morning Briefing'}
              </Text>
              <Text style={styles.briefingCardTitle}>
                {briefing
                  ? (briefing.sections?.[0]?.content?.slice(0, 80) ?? 'Tap to read your briefing') + '...'
                  : 'No briefing yet — tap to generate one'}
              </Text>
            </View>
            <Text style={styles.briefingCardArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* Today's snapshot */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today</Text>
          {todayMemories.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                Nothing scheduled today. Tap the mic button below to add an appointment or note.
              </Text>
            </View>
          ) : (
            todayMemories.slice(0, 3).map((m) => (
              <View key={m.id} style={styles.memorySnippet}>
                <View style={[styles.typeBar, { backgroundColor: typeColor(m.type) }]} />
                <Text style={styles.memoryText} numberOfLines={2}>
                  {m.summary || m.content}
                </Text>
              </View>
            ))
          )}
          {todayMemories.length > 3 && (
            <Text style={styles.moreText}>+{todayMemories.length - 3} more in Memories tab</Text>
          )}
        </View>

        {/* Ask Lighthouse */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ask Lighthouse</Text>
          <View style={styles.queryBox}>
            <TextInput
              style={styles.queryInput}
              placeholder="What would you like to know?"
              placeholderTextColor={colors.text.tertiary}
              value={question}
              onChangeText={setQuestion}
              onSubmitEditing={() => handleQuery(question)}
              returnKeyType="send"
              multiline={false}
            />
            {question.length > 0 && (
              <TouchableOpacity onPress={handleClearQuery} style={styles.clearBtn} hitSlop={8}>
                <Text style={styles.clearBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Suggested questions */}
          {!answer && !isQuerying && (
            <View style={styles.suggestions}>
              {SUGGESTED_QUESTIONS.map((q) => (
                <TouchableOpacity
                  key={q}
                  style={styles.suggestionChip}
                  onPress={() => handleQuery(q)}
                >
                  <Text style={styles.suggestionText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Ask button */}
          <TouchableOpacity
            style={[styles.askBtn, (!question.trim() || isQuerying) && styles.askBtnDisabled]}
            onPress={() => handleQuery(question)}
            disabled={!question.trim() || isQuerying}
          >
            {isQuerying ? (
              <ActivityIndicator size="small" color={colors.text.inverse} />
            ) : (
              <Text style={styles.askBtnText}>Ask</Text>
            )}
          </TouchableOpacity>

          {/* Answer */}
          {(answer || isQuerying) && (
            <Animated.View style={[styles.answerCard, { opacity: answerOpacity }]}>
              {isQuerying ? (
                <View style={styles.answerLoading}>
                  <ActivityIndicator size="small" color={colors.amber.DEFAULT} />
                  <Text style={styles.answerLoadingText}>Lighthouse is thinking...</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.answerLabel}>Lighthouse says</Text>
                  <Text style={styles.answerText}>{answer}</Text>
                </>
              )}
            </Animated.View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function typeColor(type: string): string {
  switch (type) {
    case 'Event': return colors.ocean[200];
    case 'Routine': return '#A7F3D0';
    case 'LifeMemory': return '#DDD6FE';
    case 'QuickNote': return colors.amber.light;
    case 'Person': return '#FBCFE8';
    default: return colors.border;
  }
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: spacing[5],
    paddingBottom: spacing[24],
  },
  header: {
    marginBottom: spacing[6],
  },
  greeting: {
    ...typography.display,
    color: colors.text.primary,
  },
  date: {
    ...typography.bodyLarge,
    color: colors.text.secondary,
    marginTop: spacing[1],
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    ...typography.label,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing[3],
    fontSize: 11,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  memorySnippet: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: spacing[2],
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeBar: {
    width: 4,
    borderRadius: 2,
  },
  memoryText: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
    padding: spacing[4],
    lineHeight: 24,
  },
  moreText: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'right',
    marginTop: spacing[1],
  },
  queryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing[4],
    marginBottom: spacing[3],
  },
  queryInput: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
    paddingVertical: spacing[4],
    fontSize: 16,
  },
  clearBtn: {
    padding: spacing[2],
  },
  clearBtnText: {
    color: colors.text.tertiary,
    fontSize: 14,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  suggestionChip: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
  },
  askBtn: {
    backgroundColor: colors.amber.DEFAULT,
    borderRadius: 12,
    paddingVertical: spacing[4],
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  askBtnDisabled: {
    opacity: 0.5,
  },
  askBtnText: {
    ...typography.label,
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: '700',
  },
  answerCard: {
    backgroundColor: '#FFFBF0',
    borderRadius: 16,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: colors.amber.light,
  },
  answerLabel: {
    ...typography.caption,
    color: colors.amber.dark,
    fontWeight: '700',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[2],
  },
  answerText: {
    ...typography.body,
    color: colors.text.primary,
    lineHeight: 26,
    fontSize: 16,
  },
  answerLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  answerLoadingText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  briefingCard: {
    backgroundColor: '#FFFBF0',
    borderRadius: 16,
    padding: spacing[4],
    marginBottom: spacing[5],
    borderWidth: 1,
    borderColor: colors.amber.light,
    flexDirection: 'row',
    alignItems: 'center',
  },
  briefingCardEmpty: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing[4],
    marginBottom: spacing[5],
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  briefingCardInner: {
    flex: 1,
  },
  briefingCardLabel: {
    ...typography.caption,
    color: colors.amber.dark,
    fontWeight: '700',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[1],
  },
  briefingCardTitle: {
    ...typography.body,
    color: colors.text.primary,
    lineHeight: 22,
    fontSize: 15,
  },
  briefingCardArrow: {
    fontSize: 24,
    color: colors.amber.DEFAULT,
    marginLeft: spacing[3],
  },
});
