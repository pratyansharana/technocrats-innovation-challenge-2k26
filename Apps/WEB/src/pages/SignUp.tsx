import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../config/firebase';
import '../styles/Auth.css';

const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const saveUserData = async (user: any) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || 'User',
          photoURL: user.photoURL || '',
          createdAt: new Date(),
          lastLogin: new Date(),
        });
      } else {
        // Update last login
        await setDoc(userRef, { lastLogin: new Date() }, { merge: true });
      }
    } catch (err) {
      console.error('Error saving user data:', err);
    }
  };

  const handleGoogleSignUp = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await saveUserData(result.user);
      navigate('/chat');
    } catch (err: any) {
      setError(err.message || 'Failed to sign up with Google');
      console.error('Sign up error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="model-container">
          <iframe
            title="Quantum Computer"
            frameBorder="0"
            allowFullScreen
            allow="autoplay; fullscreen; xr-spatial-tracking"
            src="https://sketchfab.com/models/82006aac41744663a161ab844264ac2a/embed?autospin=1&autostart=1&preload=1"
          />
        </div>
        {error && <p style={{ color: '#ff6b6b', textAlign: 'center', fontSize: '0.9rem' }}>{error}</p>}
        <button
          className="social-btn"
          onClick={handleGoogleSignUp}
          disabled={loading}
        >
          <span className="social-icon">🔵</span>
          {loading ? 'Signing up...' : 'Continue with Google'}
          <span className="arrow-icon">→</span>
        </button>
      </div>
    </div>
  );
};

export default SignUp;
