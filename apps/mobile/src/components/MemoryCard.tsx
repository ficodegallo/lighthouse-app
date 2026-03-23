import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Memory, MemoryType } from '@lighthouse/shared';
import { colors, typography, spacing, borderRadius, shadow } from '../theme';

const TYPE_COLORS: Record<MemoryType, string> = {
  Event: colors.sections.today,
  Routine: colors.sections.thisWeek,
  LifeMemory: colors.sections.remember,
  QuickNote: colors.fog[500],
  Person: '#059669',
};

const TYPE_LABELS: Record<MemoryType, string> = {
  Event: 'Event',
  Routine: 'Routine',
  LifeMemory: 'Life Memory',
  QuickNote: 'Quick Note',
  Person: 'Person',
};

interface MemoryCardProps {
  memory: Memory;
  onArchive?: (id: string) => void;
}

export function MemoryCard({ memory, onArchive }: MemoryCardProps) {
  const typeColor = TYPE_COLORS[memory.type];
  const typeLabel = TYPE_LABELS[memory.type];

  return (
    <View style={styles.card} accessibilityRole="article">
      {/* Colored left accent bar */}
      <View style={[styles.accent, { backgroundColor: typeColor }]} />

      <View style={styles.body}>
        {/* Type badge */}
        <View style={[styles.badge, { backgroundColor: typeColor + '18' }]}>
          <Text style={[styles.badgeText, { color: typeColor }]}>{typeLabel}</Text>
        </View>

        {/* Summary — the AI-generated warm version */}
        <Text style={styles.summary} numberOfLines={4}>
          {memory.summary}
        </Text>

        {/* Attribution + date */}
        <View style={styles.footer}>
          {memory.attributionLabel ? (
            <Text style={styles.attribution}>{memory.attributionLabel}</Text>
          ) : null}
          <Text style={styles.date}>{formatRelativeDate(memory.createdAt)}</Text>
        </View>
      </View>

      {/* Archive button */}
      {onArchive && (
        <TouchableOpacity
          style={styles.archiveButton}
          onPress={() => onArchive(memory.id)}
          accessibilityLabel="Archive this memory"
          accessibilityRole="button"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.archiveIcon}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  const diffD = Math.floor(diffH / 24);

  if (diffH < 1) return 'Just now';
  if (diffH < 24) return `${diffH}h ago`;
  if (diffD === 1) return 'Yesterday';
  if (diffD < 7) return `${diffD} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing[3],
    flexDirection: 'row',
    overflow: 'hidden',
    ...shadow.sm,
  },
  accent: {
    width: 4,
    borderTopLeftRadius: borderRadius.lg,
    borderBottomLeftRadius: borderRadius.lg,
  },
  body: {
    flex: 1,
    padding: spacing[4],
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    marginBottom: spacing[2],
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  summary: {
    ...typography.body,
    color: colors.text.primary,
    marginBottom: spacing[3],
    lineHeight: 26,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attribution: {
    ...typography.caption,
    color: colors.text.tertiary,
    fontStyle: 'italic',
  },
  date: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  archiveButton: {
    padding: spacing[4],
    justifyContent: 'center',
  },
  archiveIcon: {
    fontSize: 14,
    color: colors.fog[400],
  },
});
