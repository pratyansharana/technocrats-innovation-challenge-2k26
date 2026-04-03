import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import {AuthService} from '../Services/FirebaseAuthService';
export default function HomeScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Home Screen</Text>
      <TouchableOpacity style={{ marginTop: 20, padding: 10, backgroundColor: 'red', borderRadius: 5 }} onPress={AuthService.signOut}>
        <Text style={{ color: '#FFFFFF' }}>Logout</Text>
      </TouchableOpacity>
      <TouchableOpacity style={{ marginTop: 20, padding: 10, backgroundColor: '#007AFF', borderRadius: 5 }}>
        <Text style={{ color: '#FFFFFF' }}>Go to Handshake</Text>
      </TouchableOpacity>

    </View>
  );
}
