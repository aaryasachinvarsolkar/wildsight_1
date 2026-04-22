import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'eco_ranger_offline_queue_v1';

export async function readQueue() {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function enqueue(item) {
  const queue = await readQueue();
  queue.push(item);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return queue.length;
}

export async function clearQueue() {
  await AsyncStorage.removeItem(QUEUE_KEY);
}
