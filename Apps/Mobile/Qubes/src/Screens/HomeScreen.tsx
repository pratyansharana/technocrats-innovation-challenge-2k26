import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { AuthService } from '../Services/FirebaseAuthService';

export default function HomeScreen({ navigation }: any) {
  
  const handleLogout = async () => {
    try {
      await AuthService.signOut();
      
      // Resets the navigation stack so the user cannot press "back" to return here
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to logout properly.');
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Home Screen</Text>
      
      <TouchableOpacity 
        style={{ marginTop: 20, padding: 10, backgroundColor: 'red', borderRadius: 5 }} 
        onPress={handleLogout}
      >
        <Text style={{ color: '#FFFFFF' }}>Logout</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={{ marginTop: 20, padding: 10, backgroundColor: '#007AFF', borderRadius: 5 }}>
        <Text style={{ color: '#FFFFFF' }}>Go to Handshake</Text>
      </TouchableOpacity>

    </View>
  );
}