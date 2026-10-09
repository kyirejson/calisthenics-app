import AsyncStorage from '@react-native-async-storage/async-storage';
const key = 'personal-memory/MEMORY.md';
export async function readMemory(): Promise<string | null> { return AsyncStorage.getItem(key); }
export async function clearMemory(): Promise<void> { await AsyncStorage.removeItem(key); }
export async function writeMemory(markdown: string): Promise<void> { await AsyncStorage.setItem(key, markdown); }
