import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, typography, spacing } from '../../src/theme';
import { api } from '../../src/services/api';

interface CareCircleMember {
  id: string;
  role: string;
  caregiver: { id: string; name: string; email: string };
}

export default function SettingsScreen() {
  const router = useRouter();
  const [members, setMembers] = useState<CareCircleMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const loadCareCircle = useCallback(async () => {
    setIsLoadingMembers(true);
    try {
      const result = await api.caregivers.list();
      setMembers(result);
    } catch {
      // Not a patient or no circle yet — show empty state
    } finally {
      setIsLoadingMembers(false);
    }
  }, []);

  useEffect(() => {
    loadCareCircle();
  }, [loadCareCircle]);

  const handleInvite = useCallback(async () => {
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    setIsInviting(true);
    try {
      const result = await api.caregivers.invite(inviteEmail.trim(), inviteName.trim());
      if (result.inviteToken) {
        Alert.alert(
          'Invite created',
          `Share this link with ${inviteName.trim()}:\n\n/join?token=${result.inviteToken}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Caregiver linked!', `${inviteName.trim()} has been added to your care circle.`);
        loadCareCircle();
      }
      setInviteName('');
      setInviteEmail('');
      setShowInviteForm(false);
    } catch (err) {
      Alert.alert('Could not send invite', (err as Error).message);
    } finally {
      setIsInviting(false);
    }
  }, [inviteName, inviteEmail, loadCareCircle]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Morning Briefing */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Morning Briefing</Text>
          <SettingRow label="Delivery time" value="7:30 AM" />
          <SettingRow label="Speech rate" value="0.85x" />
          <SettingRow label="Auto-play audio" value="On" />
        </View>

        {/* Care Circle */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Care Circle</Text>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setShowInviteForm((v) => !v)}
            >
              <Text style={styles.addBtnText}>{showInviteForm ? 'Cancel' : '+ Invite'}</Text>
            </TouchableOpacity>
          </View>

          {showInviteForm && (
            <View style={styles.inviteForm}>
              <Text style={styles.inviteLabel}>Invite a caregiver to your circle</Text>
              <TextInput
                style={styles.input}
                placeholder="Their name"
                placeholderTextColor={colors.text.tertiary}
                value={inviteName}
                onChangeText={setInviteName}
                autoCapitalize="words"
              />
              <TextInput
                style={styles.input}
                placeholder="Their email"
                placeholderTextColor={colors.text.tertiary}
                value={inviteEmail}
                onChangeText={setInviteEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  (!inviteName.trim() || !inviteEmail.trim() || isInviting) && styles.sendBtnDisabled,
                ]}
                onPress={handleInvite}
                disabled={!inviteName.trim() || !inviteEmail.trim() || isInviting}
              >
                {isInviting ? (
                  <ActivityIndicator size="small" color={colors.text.inverse} />
                ) : (
                  <Text style={styles.sendBtnText}>Send invite</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {isLoadingMembers ? (
            <ActivityIndicator
              size="small"
              color={colors.amber.DEFAULT}
              style={{ marginVertical: spacing[4] }}
            />
          ) : members.length === 0 ? (
            <View style={styles.emptyCircle}>
              <Text style={styles.emptyCircleText}>
                No caregivers connected yet. Tap "+ Invite" to add a family member or caregiver.
              </Text>
            </View>
          ) : (
            members.map((m) => (
              <View key={m.id} style={styles.memberRow}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberInitial}>
                    {m.caregiver.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{m.caregiver.name}</Text>
                  <Text style={styles.memberEmail}>{m.caregiver.email}</Text>
                </View>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleText}>{m.role}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Accessibility */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Accessibility</Text>
          <SettingRow label="Display mode" value="Full" />
          <SettingRow label="Text size" value="Large (18pt)" />
        </View>

        {/* Legal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <SettingRow label="Version" value="1.0.0 (build 6)" />
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push('/privacy')}
            accessibilityRole="button"
            accessibilityLabel="Privacy Policy"
          >
            <Text style={styles.rowLabel}>Privacy Policy</Text>
            <Text style={styles.rowChevron}>›</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text.primary,
  },
  addBtn: {
    backgroundColor: colors.amber.DEFAULT,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: 20,
  },
  addBtnText: {
    ...typography.caption,
    color: colors.text.inverse,
    fontWeight: '700',
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    ...typography.body,
    color: colors.text.primary,
  },
  rowValue: {
    ...typography.body,
    color: colors.text.secondary,
  },
  rowChevron: {
    fontSize: 20,
    color: colors.text.tertiary,
  },
  inviteForm: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    padding: spacing[4],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.border,
  },
  inviteLabel: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing[3],
    fontSize: 14,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    ...typography.body,
    color: colors.text.primary,
    marginBottom: spacing[3],
    fontSize: 16,
  },
  sendBtn: {
    backgroundColor: colors.amber.DEFAULT,
    borderRadius: 10,
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendBtnText: {
    ...typography.label,
    color: colors.text.inverse,
    fontWeight: '700',
  },
  emptyCircle: {
    paddingVertical: spacing[4],
  },
  emptyCircleText: {
    ...typography.body,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 14,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.ocean[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  memberInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ocean[600],
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
  },
  memberEmail: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  roleBadge: {
    backgroundColor: colors.ocean[100],
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: 8,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.ocean[600],
  },
});
