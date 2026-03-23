import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../theme';

interface Props {
  children: React.ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            {this.props.fallbackMessage ??
              'Lighthouse ran into an unexpected error. Your memories are safe.'}
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={this.handleRetry}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Text style={styles.retryBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[8],
  },
  title: {
    ...typography.heading,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing[4],
  },
  message: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: spacing[8],
  },
  retryBtn: {
    backgroundColor: colors.amber.DEFAULT,
    borderRadius: 14,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[8],
  },
  retryBtnText: {
    ...typography.label,
    color: colors.text.inverse,
    fontWeight: '700',
    fontSize: 16,
  },
});
