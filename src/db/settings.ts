// ponytail: settings live in WatermelonDB's built-in key-value localStorage —
// no AsyncStorage dependency needed for a handful of scalar preferences.
import { database } from './index';

export const DEFAULT_DAILY_GOAL = 5;

const DAILY_GOAL_KEY = 'settings.dailyGoal';

export async function getDailyGoal(): Promise<number> {
  const value = await database.localStorage.get<number>(DAILY_GOAL_KEY);
  return value ?? DEFAULT_DAILY_GOAL;
}

export async function setDailyGoal(goal: number): Promise<void> {
  await database.localStorage.set(DAILY_GOAL_KEY, goal);
}
