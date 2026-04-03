import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

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
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
