import { AuthError, authedFetch } from './auth';

export type GoalKind = 'goal' | 'exam';

export type Goal = {
  id: string;
  kind: GoalKind;
  title: string;
  createdAt: string;
};

export async function fetchGoals(): Promise<Goal[]> {
  const response = await authedFetch('/v1/goals');

  if (!response.ok) {
    throw new AuthError('goals_failed', response.status);
  }

  const data = (await response
    .json()
    .catch(() => null)) as { goals?: Goal[] } | null;

  return data?.goals ?? [];
}

export async function createGoal(
  kind: GoalKind,
  title: string,
): Promise<Goal> {
  const response = await authedFetch('/v1/goals', {
    method: 'POST',
    body: JSON.stringify({ kind, title }),
  });

  if (!response.ok) {
    throw new AuthError('goal_failed', response.status);
  }

  const data = (await response
    .json()
    .catch(() => null)) as { goal?: Goal } | null;

  if (!data?.goal) {
    throw new AuthError('goal_failed', response.status);
  }

  return data.goal;
}

export async function deleteGoal(id: string): Promise<void> {
  const response = await authedFetch(`/v1/goals/${id}`, { method: 'DELETE' });

  if (!response.ok) {
    throw new AuthError('goal_failed', response.status);
  }
}
