import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { auth, db } from '../Firebase/FirebaseConfig'; // Make sure 'db' is exported from your config
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'; // Added Firestore imports

GoogleSignin.configure({
  webClientId: '269944139760-q234ltc97girn2den46893ra6foq0c0o.apps.googleusercontent.com',
  offlineAccess: true, 
});

export const AuthService = {
  signInWithGoogle: async () => {
    try {
      
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo?.data?.idToken;

      if (!idToken) {
        throw new Error('No ID token found');
      }

      const googleCredential = GoogleAuthProvider.credential(idToken);

      const userCredential = await signInWithCredential(auth, googleCredential);
      const user = userCredential.user;

      // --- FIRESTORE SAVE LOGIC ---
      // 1. Create a reference to the 'users' collection using the user's unique ID
      const userDocRef = doc(db, 'users', user.uid);

      // 2. Write the data to Firestore
      await setDoc(userDocRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        lastLogin: serverTimestamp(), 
      }, { merge: true }); 
      
      console.log('QUBES Secure Node Initialized for:', user.email);
      return user;

    } catch (error: any) {
      console.error('Authentication Failed:', error.message);
      throw error;
    }
  },

  signOut: async () => {
    try {
      await auth.signOut();
      await GoogleSignin.signOut();
      console.log('QUBES Node Disconnected');
    } catch (error) {
      console.error('Logout Error:', error);
    }
  }
};