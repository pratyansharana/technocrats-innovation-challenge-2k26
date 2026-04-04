import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../Firebase/FirebaseConfig';
import * as Updates from 'expo-updates';

import LoginScreen from '../Screens/LoginScreen';
import HomeScreen from '../Screens/HomeScreen';
import ChatScreen from '../Screens/ChatScreen';
import HandshakeScreen from '../Screens/HandshakeScreen';

const Stack = createNativeStackNavigator();

const PlaceholderScreen = ({ route }: any) => (
  <View style={styles.container}>
    <Text style={styles.text}>{route.name}</Text>
  </View>
);

const AppNavigator = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkAndApplyUpdates() {
      try {
        console.log('[EAS Updates] Booting update checker...');
        
        const update = await Updates.checkForUpdateAsync();

        if (update.isAvailable) {
          console.log('[EAS Updates] NEW UPDATE FOUND! Downloading...');
          
          await Updates.fetchUpdateAsync();
          console.log('[EAS Updates] Update downloaded successfully. Rebooting app...');
          
          await Updates.reloadAsync();
        } else {
          console.log('[EAS Updates] App is fully up to date. No action needed.');
        }
      } catch (error) {
        console.log('[EAS Updates] Error checking for updates:', error);
      }
    }

    checkAndApplyUpdates();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (authenticatedUser) => {
      setUser(authenticatedUser);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />
        <ActivityIndicator size="large" color="#00FFCC" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator 
        screenOptions={{ 
          headerShown: false,
          animation: 'fade_from_bottom'
        }}
      >
        {user ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="Handshake" component={HandshakeScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212'
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
  }
});

export default AppNavigator;