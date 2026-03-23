import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../src/theme';

export default function PrivacyScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.updated}>Last updated: March 2026</Text>

        <Section title="What we collect">
          Lighthouse collects the memories you add (voice transcripts converted to text, typed notes),
          your preferences (briefing time, speech rate), and basic account information (name, email).
          Voice recordings are transcribed on-device or via our API and are not stored after transcription.
        </Section>

        <Section title="How we use your data">
          Your memories are used only to generate your personal morning briefing and answer your questions.
          We do not sell, share, or use your data for advertising. Caregivers you explicitly invite can
          view and add memories on your behalf.
        </Section>

        <Section title="How we protect your data">
          All data is encrypted in transit (TLS 1.2+) and at rest (AES-256). We operate on AWS
          infrastructure under a HIPAA Business Associate Agreement. Access is controlled by role
          — only you and your invited caregivers can see your memories.
        </Section>

        <Section title="Your rights">
          You can export all your data or request deletion at any time by contacting us at
          privacy@lighthouse.care. We will fulfill requests within 30 days.
        </Section>

        <Section title="Data retention">
          Quick Notes expire automatically after 24 hours. Other memories are kept until you archive
          or delete them. Briefing audio is stored for 7 days then deleted. Audit logs are retained
          for 1 year for compliance purposes.
        </Section>

        <Section title="Third-party services">
          Lighthouse uses Anthropic (Claude API) for AI text generation and ElevenLabs for voice
          synthesis. These services process your memory text to generate responses. Both are
          contractually prohibited from using your data for their own training or purposes.
        </Section>

        <Section title="Contact">
          Questions? Email us at privacy@lighthouse.care or write to:{'\n'}
          Lighthouse Care, Inc.{'\n'}
          Privacy Team
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{children}</Text>
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
    paddingBottom: spacing[12],
  },
  updated: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginBottom: spacing[5],
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text.primary,
    marginBottom: spacing[2],
    fontSize: 17,
  },
  sectionBody: {
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: 26,
  },
});
