import AsyncStorage from '@react-native-async-storage/async-storage';
import { createIndexedJournalStorage } from './journalPersistence.mjs';

export const agentStorage = createIndexedJournalStorage(AsyncStorage, typeof indexedDB === 'undefined' ? null : indexedDB);
