import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { authErrorMessage } from '../lib/auth';
import { colors, radius } from '../theme';
import { useAuth } from './AuthProvider';

type Mode = 'login' | 'register';

export function AuthPanel() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRegister = mode === 'register';

  const submit = async () => {
    if (loading) return;

    const cleanEmail = email.trim();

    if (!cleanEmail || !password || (isRegister && !inviteCode.trim())) {
      setError('Completá todos los campos.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isRegister) {
        await register(cleanEmail, password, inviteCode.trim());
      } else {
        await login(cleanEmail, password);
      }
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Acceso completo</Text>
        <Text style={styles.title}>
          {isRegister ? 'Creá tu cuenta' : 'Iniciá sesión'}
        </Text>
        <Text style={styles.hint}>
          El timer funciona sin cuenta. Entrá para ver YouTube y tus
          estadísticas.
        </Text>

        <View style={styles.tabs}>
          <Pressable
            onPress={() => {
              setMode('login');
              setError(null);
            }}
            accessibilityRole="button"
            style={[styles.tab, !isRegister && styles.tabActive]}
          >
            <Text style={[styles.tabText, !isRegister && styles.tabTextActive]}>
              Entrar
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setMode('register');
              setError(null);
            }}
            accessibilityRole="button"
            style={[styles.tab, isRegister && styles.tabActive]}
          >
            <Text style={[styles.tabText, isRegister && styles.tabTextActive]}>
              Crear cuenta
            </Text>
          </Pressable>
        </View>

        <TextInput
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            if (error) setError(null);
          }}
          placeholder="Email"
          placeholderTextColor={colors.muted}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          editable={!loading}
        />

        <TextInput
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            if (error) setError(null);
          }}
          placeholder="Contraseña (8+ caracteres)"
          placeholderTextColor={colors.muted}
          style={styles.input}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType={isRegister ? 'newPassword' : 'password'}
          autoComplete={isRegister ? 'new-password' : 'password'}
          editable={!loading}
          onSubmitEditing={submit}
        />

        {isRegister ? (
          <TextInput
            value={inviteCode}
            onChangeText={(value) => {
              setInviteCode(value);
              if (error) setError(null);
            }}
            placeholder="Código de invitación"
            placeholderTextColor={colors.muted}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            onSubmitEditing={submit}
          />
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={submit}
          accessibilityRole="button"
          disabled={loading}
          style={({ pressed }) => [
            styles.submit,
            (pressed || loading) && styles.submitPressed,
          ]}
        >
          {loading ? (
            <ActivityIndicator color={colors.onAccent} size="small" />
          ) : (
            <Text style={styles.submitText}>
              {isRegister ? 'Crear cuenta' : 'Entrar'}
            </Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 18,
    gap: 10,
  },
  eyebrow: {
    color: colors.focus,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '600',
  },
  hint: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    padding: 3,
    marginTop: 2,
  },
  tab: {
    flex: 1,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  tabActive: {
    backgroundColor: colors.focus,
  },
  tabText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.onAccent,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 14,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 16,
  },
  submit: {
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.focus,
    marginTop: 2,
  },
  submitPressed: {
    opacity: 0.85,
  },
  submitText: {
    color: colors.onAccent,
    fontSize: 15,
    fontWeight: '700',
  },
});
