import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, Platform, AppState, AppStateStatus } from 'react-native';
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { colors, spacing, typography } from '../src/theme';
import { FloatingMicButton } from '../src/components/FloatingMicButton';
import { api } from '../src/services/api';
import { useMemoryStore } from '../src/store/memoryStore';
import { ErrorBoundary } from '../src/components/ErrorBoundary';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerPushToken() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await api.users.registerPushToken(token);
  } catch {
    // Non-fatal — push notifications degrade gracefully
  }
}

export default function RootLayout() {
  const appState = useRef(AppState.currentState);
  const { isOffline, pendingCount, syncPending } = useMemoryStore();

  useEffect(() => {
    registerPushToken();

    // Try to sync pending creates whenever the app comes to foreground
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        syncPending();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [syncPending]);

  return (
    <ErrorBoundary>
    <SafeAreaProvider>
      <StatusBar style="dark" backgroundColor={colors.background} />
      <View style={styles.root}>
        {/* Offline banner */}
        {(isOffline || pendingCount > 0) && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerText}>
              {pendingCount > 0
                ? `${pendingCount} memor${pendingCount === 1 ? 'y' : 'ies'} will sync when you're back online`
                : 'You\'re offline — showing cached memories'}
            </Text>
          </View>
        )}
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text.primary,
            headerShadowVisible: false,
            animation: 'fade',
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="capture"
            options={{
              title: 'New Memory',
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="privacy"
            options={{ title: 'Privacy Policy', animation: 'slide_from_right' }}
          />
        </Stack>

        {/* Floating mic button — visible on all tab screens, hidden on modal */}
        <FloatingMicButton />
      </View>
    </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  offlineBanner: {
    backgroundColor: colors.fog[500],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    alignItems: 'center',
  },
  offlineBannerText: {
    ...typography.caption,
    color: colors.text.inverse,
    fontSize: 12,
    textAlign: 'center',
  },
});
