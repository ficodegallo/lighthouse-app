import { useState, useCallback } from 'react';
import * as Haptics from 'expo-haptics';

export type RecordingState = 'idle' | 'recording' | 'processing';

interface UseVoiceCaptureReturn {
  recordingState: RecordingState;
  transcript: string;
  /** Whether we're running in Expo Go without native speech support */
  isStubMode: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string>;
  reset: () => void;
  error: string | null;
}

/**
 * Voice capture hook.
 *
 * In Expo Go: runs in stub mode — mic button is visible, tap cycles through a
 * demo transcript so the full capture → classify → confirm flow can be tested.
 *
 * In a custom dev build: swap the stub body for expo-speech-recognition calls
 * (the native module will be available).
 *
 * PRD VC-02: tap-to-record, tap-to-stop (no hold required).
 */
export function useVoiceCapture(): UseVoiceCaptureReturn {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Expo Go stub — cycles through realistic demo transcripts
  const DEMO_TRANSCRIPTS = [
    "I have a doctor's appointment with Dr. Patel at 2 PM today.",
    "Jess called — the new baby's name is Rory.",
    "Take blood pressure medication after breakfast every morning.",
    "Parked on level 3, row B next to the blue pillar.",
    "Lunch with Scott at the Italian place on Thursday at noon.",
  ];
  const [demoIndex, setDemoIndex] = useState(0);

  const startRecording = useCallback(async () => {
    setError(null);
    setTranscript('');
    setRecordingState('recording');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Simulate the transcript appearing word-by-word
    const demo = DEMO_TRANSCRIPTS[demoIndex % DEMO_TRANSCRIPTS.length] ?? '';
    const words = demo.split(' ');
    for (let i = 1; i <= words.length; i++) {
      await new Promise((r) => setTimeout(r, 120));
      setTranscript(words.slice(0, i).join(' '));
    }
  }, [demoIndex]);

  const stopRecording = useCallback(async (): Promise<string> => {
    setRecordingState('processing');
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await new Promise((r) => setTimeout(r, 400));

    const final = DEMO_TRANSCRIPTS[demoIndex % DEMO_TRANSCRIPTS.length] ?? '';
    setDemoIndex((i) => i + 1);
    setRecordingState('idle');
    return final;
  }, [demoIndex]);

  const reset = useCallback(() => {
    setTranscript('');
    setRecordingState('idle');
    setError(null);
  }, []);

  return {
    recordingState,
    transcript,
    isStubMode: true,
    startRecording,
    stopRecording,
    reset,
    error,
  };
}
