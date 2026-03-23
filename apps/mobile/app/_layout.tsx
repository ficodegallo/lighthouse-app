import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Platform } from 'react-native';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { colors } from '../src/theme';
import { FloatingMicButton } from '../src/components/FloatingMicButton';
import { api } from '../src/services/api';

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
  useEffect(() => {
    registerPushToken();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" backgroundColor={colors.background} />
      <View style={styles.root}>
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
        </Stack>

        {/* Floating mic button — visible on all tab screens, hidden on modal */}
        <FloatingMicButton />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
