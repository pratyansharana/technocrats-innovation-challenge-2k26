import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyDLHIVgZJ9hiSHNXKTgC0nKqTocJcSSRmI",
  authDomain: "qubes-tic.firebaseapp.com",
  projectId: "qubes-tic",
  storageBucket: "qubes-tic.firebasestorage.app",
  messagingSenderId: "269944139760",
  appId: "1:269944139760:web:9aac1765bc6296cd1f7735",
  measurementId: "G-TSD5TJL2K2"
};

const app = initializeApp(firebaseConfig);


export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

export const db = getFirestore(app);

export default app;