import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  createGoal,
  deleteGoal,
  fetchGoals,
  type Goal,
  type GoalKind,
} from '../lib/goals';
import { colors, radius } from '../theme';

const COLUMNS: {
  kind: GoalKind;
  title: string;
  placeholder: string;
}[] = [
  { kind: 'goal', title: 'Objetivos', placeholder: 'Nuevo objetivo' },
  {
    kind: 'exam',
    title: 'Parciales y recuperatorios',
    placeholder: 'Parcial o recuperatorio',
  },
];

export function GoalsPanel() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [drafts, setDrafts] = useState<Record<GoalKind, string>>({
    goal: '',
    exam: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchGoals()
      .then((list) => {
        if (!cancelled) setGoals(list);
      })
      .catch(() => {
        if (!cancelled) setError('No pude cargar tus objetivos.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const add = useCallback(
    async (kind: GoalKind) => {
      const title = drafts[kind].trim();
      if (!title || saving) return;

      setSaving(true);
      setError(null);

      try {
        const goal = await createGoal(kind, title);
        setGoals((current) => [goal, ...current]);
        setDrafts((current) => ({ ...current, [kind]: '' }));
      } catch {
        setError('No pude guardar. Probá de nuevo.');
      } finally {
        setSaving(false);
      }
    },
    [drafts, saving],
  );

  const remove = useCallback(
    async (goal: Goal) => {
      const previous = goals;
      setError(null);
      setGoals((current) => current.filter((item) => item.id !== goal.id));

      try {
        await deleteGoal(goal.id);
      } catch {
        setGoals(previous);
        setError('No pude quitar. Probá de nuevo.');
      }
    },
    [goals],
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {COLUMNS.map((column) => {
          const items = goals.filter((goal) => goal.kind === column.kind);
          const canAdd = drafts[column.kind].trim().length > 0 && !saving;

          return (
            <View key={column.kind} style={styles.card}>
              <Text style={styles.title}>{column.title}</Text>

              <View style={styles.inputRow}>
                <TextInput
                  value={drafts[column.kind]}
                  onChangeText={(value) => {
                    setDrafts((current) => ({ ...current, [column.kind]: value }));
                    if (error) setError(null);
                  }}
                  onSubmitEditing={() => add(column.kind)}
                  placeholder={column.placeholder}
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  maxLength={120}
                  returnKeyType="done"
                  editable={!saving}
                />

                <Pressable
                  onPress={() => add(column.kind)}
                  disabled={!canAdd}
                  accessibilityRole="button"
                  accessibilityLabel={`Agregar a ${column.title}`}
                  style={({ pressed }) => [
                    styles.addButton,
                    !canAdd && styles.addButtonDisabled,
                    pressed && styles.addButtonPressed,
                  ]}
                >
                  <Text style={styles.addText}>+</Text>
                </Pressable>
              </View>

              <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
              >
                {items.length === 0 ? (
                  <Text style={styles.empty}>
                    {loading ? 'Cargando…' : 'Nada por acá.'}
                  </Text>
                ) : (
                  items.map((goal) => (
                    <View key={goal.id} style={styles.item}>
                      {goal.title.includes('|') ? (
                        <View style={styles.columnsRow}>
                          {goal.title.split('|').map((part, idx) => (
                            <Text
                              key={idx}
                              numberOfLines={1}
                              style={[
                                styles.columnText,
                                idx === 0 && styles.colLeft,
                                idx === 1 && styles.colCenter,
                                idx === 2 && styles.colRight,
                              ]}
                            >
                              {part.trim()}
                            </Text>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.itemText} numberOfLines={2}>
                          {goal.title}
                        </Text>
                      )}

                      <Pressable
                        onPress={() => remove(goal)}
                        accessibilityRole="button"
                        accessibilityLabel={`Quitar ${goal.title}`}
                        hitSlop={8}
                        style={({ pressed }) => [
                          styles.removeButton,
                          pressed && styles.removePressed,
                        ]}
                      >
                        <Text style={styles.removeText}>×</Text>
                      </Pressable>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: {
    // Al fijar una altura (o minHeight), el panel superior se expande y deja ver más elementos
    minHeight: 260,
    maxHeight: 340,
    padding: 10,
    gap: 4,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 8,
    gap: 6,
  },
  title: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  input: {
    flex: 1,
    height: 30,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 0,
    fontSize: 11,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  addButton: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.focus,
  },
  addButtonDisabled: {
    opacity: 0.4,
  },
  addButtonPressed: {
    opacity: 0.8,
  },
  addText: {
    color: colors.onAccent,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 4,
    paddingBottom: 2,
  },
  empty: {
    color: colors.muted,
    fontSize: 10,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingLeft: 8,
    paddingRight: 4,
    paddingVertical: 4,
  },
  itemText: {
    flex: 1,
    color: colors.text,
    fontSize: 11,
    lineHeight: 14,
  },
  // --- NUEVOS ESTILOS PARA LAS 3 COLUMNAS ---
  columnsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  columnText: {
    flex: 1, // Hace que cada sección ocupe exactamente 1/3 del ancho
    color: colors.text,
    fontSize: 11,
    lineHeight: 14,
  },
  colLeft: {
    textAlign: 'left',
  },
  colCenter: {
    textAlign: 'center',
  },
  colRight: {
    textAlign: 'right',
    paddingRight: 6,
  },
  // ------------------------------------------
  removeButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePressed: {
    backgroundColor: colors.surfaceAlt,
  },
  removeText: {
    color: colors.danger,
    fontSize: 15,
    lineHeight: 17,
    fontWeight: '600',
  },
  error: {
    color: colors.danger,
    fontSize: 10,
  },
});