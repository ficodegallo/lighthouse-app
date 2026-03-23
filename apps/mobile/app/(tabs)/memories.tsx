import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Memory } from '@lighthouse/shared';
import { colors, typography, spacing } from '../../src/theme';
import { MemoryCard } from '../../src/components/MemoryCard';
import { useMemoryStore } from '../../src/store/memoryStore';
import { api } from '../../src/services/api';

const MEMORY_TABS = [
  { label: 'Today', horizon: 'Today' },
  { label: 'This Week', horizon: 'ThisWeek' },
  { label: 'Life', horizon: 'Always' },
  { label: 'People', horizon: 'People' },
] as const;

type TabKey = typeof MEMORY_TABS[number]['horizon'];

export default function MemoriesScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>('Today');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [people, setPeople] = useState<Memory[]>([]);
  const [isPeopleLoading, setIsPeopleLoading] = useState(false);

  const { memories, isLoading, fetchMemories, archiveMemory } = useMemoryStore();

  useEffect(() => {
    if (activeTab === 'People') {
      loadPeople();
    } else {
      fetchMemories(activeTab);
    }
  }, [activeTab]);

  const loadPeople = useCallback(async () => {
    setIsPeopleLoading(true);
    try {
      const result = await api.memories.list({ type: 'Person' });
      setPeople(result);
    } catch {
      // silently fail — empty state will show
    } finally {
      setIsPeopleLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    if (activeTab === 'People') {
      await loadPeople();
    } else {
      await fetchMemories(activeTab);
    }
    setIsRefreshing(false);
  }, [activeTab, fetchMemories, loadPeople]);

  const handleArchive = useCallback((id: string) => {
    Alert.alert(
      'Archive memory?',
      'This memory will be moved to your archive.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: () => {
            archiveMemory(id);
            if (activeTab === 'People') {
              setPeople((prev) => prev.filter((m) => m.id !== id));
            }
          },
        },
      ]
    );
  }, [archiveMemory, activeTab]);

  const listData =
    activeTab === 'People'
      ? people
      : memories.filter((m) => m.horizon === activeTab);

  const listLoading = activeTab === 'People' ? isPeopleLoading : isLoading;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {MEMORY_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.horizon}
            style={[styles.tab, activeTab === tab.horizon && styles.tabActive]}
            onPress={() => setActiveTab(tab.horizon)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab.horizon }}
          >
            <Text style={[styles.tabText, activeTab === tab.horizon && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) =>
          activeTab === 'People' ? (
            <PersonCard memory={item} onArchive={handleArchive} />
          ) : (
            <MemoryCard memory={item} onArchive={handleArchive} />
          )
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.amber.DEFAULT}
          />
        }
        ListEmptyComponent={
          !listLoading ? <EmptyState tab={activeTab} /> : null
        }
      />
    </SafeAreaView>
  );
}

/** Person-type card — contact-card style */
function PersonCard({ memory, onArchive }: { memory: Memory; onArchive?: (id: string) => void }) {
  const initial = (memory.summary || memory.content || '?')[0].toUpperCase();

  return (
    <View style={personStyles.card} accessibilityRole="article">
      <View style={personStyles.avatar}>
        <Text style={personStyles.initial}>{initial}</Text>
      </View>
      <View style={personStyles.body}>
        <Text style={personStyles.summary} numberOfLines={3}>
          {memory.summary || memory.content}
        </Text>
        {memory.attributionLabel ? (
          <Text style={personStyles.attribution}>{memory.attributionLabel}</Text>
        ) : null}
      </View>
      {onArchive && (
        <TouchableOpacity
          style={personStyles.archiveBtn}
          onPress={() => onArchive(memory.id)}
          accessibilityLabel="Archive"
          hitSlop={12}
        >
          <Text style={personStyles.archiveIcon}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function EmptyState({ tab }: { tab: TabKey }) {
  const messages: Record<TabKey, { title: string; hint: string }> = {
    Today: {
      title: 'Nothing for today yet',
      hint: 'Tap the microphone button to add an appointment, medication, or quick note.',
    },
    ThisWeek: {
      title: 'Nothing coming up this week',
      hint: 'Add an upcoming appointment or event and it will appear here.',
    },
    Always: {
      title: 'No life memories yet',
      hint: 'Share an important story, family fact, or treasured memory — it will live here always.',
    },
    People: {
      title: 'No people saved yet',
      hint: 'Say "David is my son" or "Dr. Patel is my cardiologist" to add someone to your people directory.',
    },
  };

  const { title, hint } = messages[tab];

  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyHint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing[3],
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: colors.transparent,
    marginBottom: -1,
  },
  tabActive: {
    borderBottomColor: colors.amber.DEFAULT,
  },
  tabText: {
    ...typography.label,
    color: colors.text.secondary,
    fontSize: 12,
  },
  tabTextActive: {
    color: colors.amber.dark,
    fontWeight: '700',
  },
  list: {
    padding: spacing[4],
    paddingBottom: spacing[20],
  },
  empty: {
    paddingVertical: spacing[12],
    alignItems: 'center',
    paddingHorizontal: spacing[8],
  },
  emptyTitle: {
    ...typography.bodyLarge,
    color: colors.text.secondary,
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: spacing[3],
  },
  emptyHint: {
    ...typography.body,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 26,
  },
});

const personStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginBottom: spacing[3],
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FBCFE8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
    flexShrink: 0,
  },
  initial: {
    fontSize: 20,
    fontWeight: '700',
    color: '#BE185D',
  },
  body: {
    flex: 1,
  },
  summary: {
    ...typography.body,
    color: colors.text.primary,
    lineHeight: 24,
  },
  attribution: {
    ...typography.caption,
    color: colors.text.tertiary,
    fontStyle: 'italic',
    marginTop: spacing[1],
  },
  archiveBtn: {
    padding: spacing[2],
    marginLeft: spacing[2],
  },
  archiveIcon: {
    fontSize: 14,
    color: colors.fog[400],
  },
});
