import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';

type Props = {
  email?: string;
  onLogout: () => void;
};

export function AccountBar({ email, onLogout }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.email} numberOfLines={1}>
        {email ?? 'Cuenta'}
      </Text>
      <Pressable
        onPress={() => {
          void onLogout();
        }}
        accessibilityRole="button"
        hitSlop={8}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.buttonText}>Salir</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  email: {
    flex: 1,
    color: colors.muted,
    fontSize: 11,
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  buttonPressed: {
    backgroundColor: colors.border,
  },
  buttonText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '600',
  },
});
