import React from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { AlertOctagon, RefreshCw } from 'lucide-react-native';
import { Text } from './Text';
import { Colors } from '../../constants/colors';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors anywhere below it so a single broken screen
 * shows a recovery screen instead of a blank app. Wraps the whole
 * router in app/_layout.tsx.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.warn('[ErrorBoundary] caught render error:', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.container}>
        <View style={styles.icon}>
          <AlertOctagon size={48} color={Colors.danger} />
        </View>
        <Text variant="h2" style={styles.title}>
          Oups, quelque chose s&apos;est mal passé
        </Text>
        <Text variant="body" color={Colors.textSecondary} style={styles.subtitle}>
          L&apos;app a rencontré une erreur inattendue. Tes données enregistrées
          sont en sécurité — un redémarrage devrait suffire.
        </Text>

        <Pressable onPress={this.reset} style={styles.button}>
          <RefreshCw size={18} color={Colors.white} />
          <Text variant="body" color={Colors.white} style={styles.buttonText}>
            Réessayer
          </Text>
        </Pressable>

        {__DEV__ && (
          <ScrollView style={styles.devBox} contentContainerStyle={styles.devContent}>
            <Text variant="caption" color={Colors.textSecondary}>
              {this.state.error.name}: {this.state.error.message}
            </Text>
            {this.state.error.stack ? (
              <Text variant="caption" color={Colors.textSecondary} style={styles.devStack}>
                {this.state.error.stack}
              </Text>
            ) : null}
          </ScrollView>
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  icon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FECDD3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: {
    fontWeight: '600',
  },
  devBox: {
    maxHeight: 220,
    marginTop: 32,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    width: '100%',
  },
  devContent: {
    padding: 12,
  },
  devStack: {
    marginTop: 8,
    fontFamily: 'monospace',
  },
});
