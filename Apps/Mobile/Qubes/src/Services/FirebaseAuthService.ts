import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { auth } from '../Firebase/FirebaseConfig';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';


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
      
      console.log('QUBES Secure Node Initialized for:', userCredential.user.email);
      return userCredential.user;

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