import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  ScrollView,
  StatusBar,
  Alert,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HandshakeScreen({ route, navigation }: any) {
  // Safely extract the passed user data (if navigating from the Home screen list)
  const { user } = route.params || {};
  
  const [nodeId, setNodeId] = useState(user?.uid || '');
  const [logs, setLogs] = useState<string[]>(['[SYS] Awaiting target identification...']);
  const [isConnecting, setIsConnecting] = useState(false);

  // QUBES Theme Colors (Matched exactly to Login Screen)
  const colors = {
    background: '#0A0A0A', 
    text: '#FFFFFF',
    textSecondary: '#888888',
    primary: '#00FFCC',    
    surface: '#1A1A1A',
    border: '#2A2A2A',
    terminal: '#050505',
  };

  const addLog = (message: string) => {
    setLogs(prev => [...prev, message]);
  };

  const handleInitialize = () => {
    if (!nodeId.trim()) {
      Alert.alert("Input Required", "Please enter a valid Target ID.");
      return;
    }

    setIsConnecting(true);
    setLogs(['[SYS] Initiating BB84 Quantum Handshake...']);

    // Simulate a cryptographic handshake sequence
    setTimeout(() => addLog('[SEC] Resolving address protocol...'), 800);
    setTimeout(() => addLog('[SEC] Exchanging ephemeral keys...'), 1600);
    setTimeout(() => addLog('[SEC] Establishing shared secret...'), 2600);
    setTimeout(() => {
      addLog('[SUCCESS] Zero Trace channel established.');
      setIsConnecting(false);
      Alert.alert("Connection Established", "Secure node has been verified and added.", [
        { text: "Continue", onPress: () => navigation.goBack() }
      ]);
    }, 3500);
  };

  return (
    <SafeAreaView style={[styles.mainContainer, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>X</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>INITIALIZE NODE</Text>
        <View style={{ width: 40 }} /> {/* Spacer to balance the header */}
      </View>

      {/* CONTENT AREA */}
      <View style={styles.contentArea}>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>TARGET IDENTIFIER</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. QUBES-9X8V..."
            placeholderTextColor={colors.textSecondary}
            value={nodeId}
            onChangeText={setNodeId}
            autoCapitalize="characters"
            editable={!isConnecting}
            autoCorrect={false}
          />
          <Text style={styles.helperText}>
            Enter the target's cryptographic seed to establish a Zero Trace tunnel.
          </Text>
        </View>
      </View>

      {/* TERMINAL LOGS */}
      <View style={[styles.terminalContainer, { borderColor: colors.border, backgroundColor: colors.terminal }]}>
        <View style={[styles.terminalHeader, { borderBottomColor: colors.border }]}>
          <Text style={styles.terminalTitle}>PROTOCOL LOG</Text>
        </View>
        <ScrollView style={styles.terminalBody} showsVerticalScrollIndicator={false}>
          {logs.map((log, index) => (
            <Text key={index} style={[
              styles.terminalText,
              log.includes('[SUCCESS]') && { color: colors.primary },
              log.includes('[SEC]') && { color: '#AAAAAA' }
            ]}>
              {log}
            </Text>
          ))}
        </ScrollView>
      </View>

      {/* ACTION BUTTON (Matched to Login Screen) */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[
            styles.actionButton, 
            isConnecting ? styles.actionButtonDisabled : { backgroundColor: colors.primary }
          ]}
          onPress={handleInitialize}
          disabled={isConnecting}
        >
          <View style={styles.buttonInner}>
            <Text style={[
              styles.actionButtonText, 
              isConnecting ? { color: colors.textSecondary } : { color: '#000000' }
            ]}>
              {isConnecting ? 'NEGOTIATING KEYS...' : 'CONNECT NODE'}
            </Text>
            {!isConnecting && <Text style={styles.chevronIcon}> ➔</Text>}
          </View>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mainContainer: { 
    flex: 1,
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  backBtn: {
    padding: 10,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
  },
backIcon: {
    fontSize: 32,
    color: '#9CA3AF',
    fontWeight: '300',
    marginTop: -4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  contentArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  inputContainer: {
    width: '100%',
  },
  inputLabel: {
    color: '#00FFCC',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 10,
    marginLeft: 5,
  },
  textInput: {
    backgroundColor: '#1A1A1A',
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    letterSpacing: 2,
    textAlign: 'center',
  },
  helperText: {
    color: '#888888',
    fontSize: 13,
    marginTop: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  terminalContainer: {
    height: 180,
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  terminalHeader: {
    backgroundColor: '#111111',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  terminalTitle: {
    color: '#555555',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  terminalBody: {
    padding: 16,
  },
  terminalText: {
    color: '#00FFCC',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 8,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  actionButton: {
    paddingVertical: 18, 
    paddingHorizontal: 30, 
    borderRadius: 14, 
    width: '100%',
    shadowColor: "#00FFCC",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  actionButtonDisabled: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonInner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  chevronIcon: { 
    fontWeight: 'bold', 
    fontSize: 18, 
    marginLeft: 4, 
    color: '#000000' 
  },
});