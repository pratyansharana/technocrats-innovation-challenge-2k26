import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/Navigation/AppNavigator';

const App = () => {
  return (
    <SafeAreaProvider>
        <AppNavigator />
    </SafeAreaProvider>
  );
};

export default App;