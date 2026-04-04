import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  Alert, 
  TouchableOpacity, 
  SafeAreaView,
  Modal,
  ScrollView,
  Platform,
  StatusBar
} from 'react-native';
import Animated, { FadeInDown, FadeIn, Layout, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

// Firebase Firestore Imports
import { doc, onSnapshot, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../Firebase/FirebaseConfig'; 
import { QuantumKeyService } from '../Services/QuantumService';

export default function HandshakeScreen({ route, navigation }: any) {
  // 1. Safely extract params so it never crashes if empty
  const { sessionId: passedSessionId, targetUser } = route.params || {};
  const currentUser = auth.currentUser;

  // Generate a unique room ID based on both users' UIDs
  const sessionId = passedSessionId || (currentUser?.uid && targetUser?.uid 
    ? [currentUser.uid, targetUser?.uid].sort().join('_') 
    : 'waiting_room');
  
  const [role, setRole] = useState<'alice' | 'bob' | null>(null);
  const [status, setStatus] = useState('initializing');
  const [showViz, setShowViz] = useState(false);
  
  const aliceDataRef = useRef<{ bits: any[], bases: any[] } | null>(null);
  const roleLocked = useRef(false);
  const isAbortingRef = useRef(false);

  // ==========================================
  // 1. "FIRST TO SHOOT" & ABORT DETECTOR LISTENER
  // ==========================================
  useEffect(() => {
    if (!currentUser) return;

    // Firestore reference to the specific session document
    const sessionRef = doc(db, 'sessions', sessionId);
    
    const unsubscribe = onSnapshot(sessionRef, (snapshot) => {
      // If the room doesn't exist, create it instead of kicking the user
      if (!snapshot.exists()) {
        setDoc(sessionRef, { 
          status: 'ready_to_start',
          createdAt: new Date().toISOString() 
        }, { merge: true });
        return; 
      }

      const data = snapshot.data();

      // If the room was reset/aborted by the other user, then kick them out
      if (roleLocked.current && data.status === 'initializing' && !isAbortingRef.current) {
        aliceDataRef.current = null; 
        Alert.alert("Link Severed", "The peer terminated the quantum key exchange.");
        navigation.replace('Home');
        return;
      }

      // 🔐 DYNAMIC ROLE ASSIGNMENT BASED ON 'aliceId'
      if (!roleLocked.current && data.aliceId) {
        if (data.aliceId === currentUser.uid) {
          setRole('alice');
        } else {
          setRole('bob');
        }
        roleLocked.current = true;
      }

      // 🚦 STATE MACHINE
      if (data.handshakeComplete) {
        if (status !== 'secure') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStatus('secure');
      } else if (data.bobBases) {
        setStatus((role === 'alice' || (roleLocked.current && data.aliceId === currentUser.uid)) ? 'sifting' : 'waiting_for_alice');
      } else if (data.quantumPayload) {
        setStatus((role === 'bob' || (roleLocked.current && data.aliceId !== currentUser.uid)) ? 'ready_to_measure' : 'waiting_for_bob');
      } else if (data.aliceId) {
        setStatus((role === 'bob' || (roleLocked.current && data.aliceId !== currentUser.uid)) ? 'waiting_for_photons' : 'transmitting');
      } else {
        setStatus('ready_to_start');
      }
    });

    return () => unsubscribe();
  }, [sessionId, currentUser]); 

  // ==========================================
  // 2. CLAIM ALICE ROLE & FIRE PHOTONS
  // ==========================================
  const startQuantumTransmission = async () => {
    if (!currentUser) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    setRole('alice');
    roleLocked.current = true;
    setStatus('transmitting');
    
    const sessionRef = doc(db, 'sessions', sessionId);

    // Instantly claim the role in Firestore BEFORE the API call
    await updateDoc(sessionRef, {
      aliceId: currentUser.uid, 
      status: 'transmitting'
    });
    
    // Perform the API generation via your custom service
    const result = await QuantumKeyService.generateAndTransmit(256, false);
    
    // ⚠️ CHECK FOR EAVESDROPPING DETECTION
    if (result.eavesdropping_detected) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      // Reset the session immediately
      setRole(null);
      roleLocked.current = false;
      await updateDoc(sessionRef, {
        aliceId: null,
        status: 'initializing'
      });
      
      // Alert the user about the compromise
      Alert.alert(
        "🚨 SECURE CHANNEL COMPROMISED 🚨",
        "EAVESDROPPING DETECTED!\n\nUnauthorized quantum interference detected on the transmission channel. The BB84 protocol has automatically aborted to maintain security.\n\nReason: Observer effect detected due to unauthorized basis measurement.\n\nThis handshake is INVALID. Do not proceed.",
        [{ text: "Return to Directory", onPress: () => navigation.replace('Home') }],
        { cancelable: false }
      );
      return;
    }
    
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      aliceDataRef.current = { bits: result.aliceBits, bases: result.aliceBases };

      await updateDoc(sessionRef, {
        quantumPayload: result.photonsForBob,
        status: 'photons_sent'
      });
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Quantum Error", "Vercel API Failed.");
      
      setRole(null);
      roleLocked.current = false;
      await updateDoc(sessionRef, {
        aliceId: null, 
        status: 'ready_to_start'
      });
    }
  };

  // ==========================================
  // 3. BOB: MEASURE
  // ==========================================
  const measurePhotons = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStatus('measuring');
    
    const sessionRef = doc(db, 'sessions', sessionId);
    const snap = await getDoc(sessionRef);
    const photons = snap.data()?.quantumPayload;

    if (!photons) {
      Alert.alert("Error", "No photons to measure.");
      setStatus('ready_to_measure');
      return;
    }

    const bobBases = photons.map(() => Math.random() > 0.5 ? 'X' : '+');
    
    await updateDoc(sessionRef, {
      bobBases: bobBases,
    });
  };

  // ==========================================
  // 4. ALICE: AUTOMATIC SIFTING TRIGGER
  // ==========================================
  useEffect(() => {
    if (role === 'alice') {
      const sessionRef = doc(db, 'sessions', sessionId);
      
      const unsubscribeSift = onSnapshot(sessionRef, async (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data();
        const bobBases = data.bobBases;
        
        if (bobBases && aliceDataRef.current) {
          const matchingIndexes = aliceDataRef.current.bases
            .map((b, i) => b === bobBases[i] ? i : null)
            .filter(v => v !== null);

          // If handshake isn't already complete, finalize it
          if (!data.handshakeComplete) {
            await updateDoc(sessionRef, {
              matchingIndexes: matchingIndexes,
              handshakeComplete: true
            });
          }
        }
      });

      return () => unsubscribeSift();
    }
  }, [role, sessionId]);

  // ==========================================
  // 5. ABORT HANDSHAKE
  // ==========================================
  const killSession = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    isAbortingRef.current = true; 
    aliceDataRef.current = null; 
    
    const sessionRef = doc(db, 'sessions', sessionId);
    await updateDoc(sessionRef, {
      handshakeComplete: false,
      quantumPayload: null,
      bobBases: null,
      matchingIndexes: null,
      aliceId: null, 
      status: 'initializing'
    });
    
    navigation.replace('Home');
  };

  // --- UI HELPERS ---
  const getStatusMessage = () => {
    switch(status) {
      case 'initializing': return "WAKING UP QUANTUM CHANNEL...";
      case 'ready_to_start': return "CHANNEL IDLE. READY TO INITIATE.";
      case 'waiting_for_photons': return "PEER IS PREPARING PHOTONS..."; 
      case 'transmitting': return "FIRING 256 POLARIZED PHOTONS...";
      case 'waiting_for_bob': return "PHOTONS IN TRANSIT. AWAITING BOB.";
      case 'ready_to_measure': return "PHOTONS ARRIVED. READY TO MEASURE.";
      case 'measuring': return "APPLYING RANDOM MEASUREMENT BASES...";
      case 'waiting_for_alice': return "BASES SENT. AWAITING ALICE'S SIFTING.";
      case 'sifting': return "COMPARING BASES. DISCARDING MISMATCHES...";
      case 'secure': return "AES-256 KEY GENERATED SUCCESSFULLY.";
      default: return status.toUpperCase();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />
      
      <Animated.View entering={FadeInDown.duration(600)} layout={Layout.springify()} style={styles.card}>
        
        <View style={styles.header}>
          <Text style={styles.monoTextTny}>SECURE PROTOCOL // BB84</Text>
          <Text style={styles.title}>LINK HANDSHAKE</Text>
          <Text style={styles.partnerText}>TARGET: <Text style={{fontWeight: '900', color: '#FFFFFF'}}>{targetUser?.name?.toUpperCase() || 'UNKNOWN PEER'}</Text></Text>
        </View>
        
        <View style={styles.divider} />
        
        <Animated.View entering={ZoomIn.delay(300)} style={[styles.roleBadge, { 
          backgroundColor: role ? 'rgba(0, 255, 204, 0.05)' : '#050505',
          borderColor: role ? '#00FFCC' : '#2A2A2A'
        }]}>
          <Text style={[styles.roleText, { color: role ? '#00FFCC' : '#888888' }]}>
            {role ? `IDENTITY LOCKED: ${role.toUpperCase()}` : 'AWAITING INITIATOR...'}
          </Text>
        </Animated.View>

        <View style={styles.hudContainer}>
          <Text style={styles.hudLabel}>PROTOCOL STATUS</Text>
          <Text style={[styles.hudValue, { color: status === 'secure' ? '#00FFCC' : '#FFFFFF' }]}>
            {getStatusMessage()}
          </Text>
        </View>

        {/* NEUTRAL / ALICE BUTTON */}
        {(role === null || role === 'alice') && status === 'ready_to_start' && (
          <Animated.View entering={FadeIn}>
            <TouchableOpacity style={styles.primaryBtn} onPress={startQuantumTransmission} activeOpacity={0.8}>
              <Text style={styles.btnText}>INITIATE QUANTUM TRANSMISSION</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* BOB BUTTON */}
        {role === 'bob' && status === 'ready_to_measure' && (
          <Animated.View entering={FadeIn}>
            <TouchableOpacity style={styles.primaryBtn} onPress={measurePhotons} activeOpacity={0.8}>
              <Text style={styles.btnText}>EXECUTE MEASUREMENT</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {(status.includes('waiting') || status === 'sifting' || status === 'transmitting' || status === 'measuring') && (
          <Animated.View entering={FadeIn} style={styles.loaderBox}>
            <ActivityIndicator size="large" color="#00FFCC" />
            <Text style={styles.loaderText}>SYNCING VIA SECURE RELAY...</Text>
          </Animated.View>
        )}

        {/* SUCCESS STATE */}
        {status === 'secure' && (
          <Animated.View entering={ZoomIn.springify()} style={styles.secureBox}>
            <Text style={styles.secureTitle}>SECURE LINK ESTABLISHED</Text>
            <TouchableOpacity 
              style={[styles.primaryBtn, { width: '100%', marginTop: 10, shadowColor: 'transparent' }]} 
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                navigation.replace('Chat', { sessionId, targetUser });
              }}
            >
              <Text style={styles.btnText}>ENTER ENCRYPTED CHAT 〉</Text>
            </TouchableOpacity>
            
            {role === 'alice' && (
              <TouchableOpacity onPress={() => setShowViz(true)} style={styles.vizBtn}>
                <Text style={styles.vizBtnText}>VIEW QUANTUM METRICS</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        )}

        {/* KILL SWITCH */}
        {status !== 'secure' && (
          <TouchableOpacity style={styles.killBtn} onPress={killSession}>
            <Text style={styles.killBtnText}>[ ABORT PROTOCOL ]</Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* METRICS MODAL */}
      <Modal visible={showViz} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>BB84 TERMINAL</Text>
              <TouchableOpacity onPress={() => setShowViz(false)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false}>
               <Text style={styles.label}>ALICE'S PREPARED BASES (LOCAL MEMORY)</Text>
               <View style={styles.terminalBox}>
                 <Text style={styles.terminalText}>{aliceDataRef.current?.bases.slice(0, 50).join('')}...</Text>
               </View>

               <Text style={styles.label}>ALICE'S PREPARED BITS (LOCAL MEMORY)</Text>
               <View style={styles.terminalBox}>
                 <Text style={styles.terminalText}>{aliceDataRef.current?.bits.slice(0, 50).join('')}...</Text>
               </View>
               
               <View style={styles.infoCard}>
                  <Text style={styles.infoTitle}>SIFTING COMPLETE</Text>
                  <Text style={styles.infoText}>
                    The backend simulated the Quantum Channel. Bob randomly guessed the measurement bases. Only the indexes where Bob's bases perfectly matched Alice's were kept. The resulting bitstring forms the AES-256 key.
                  </Text>
               </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A', justifyContent: 'center', padding: 20 },
  card: { 
    backgroundColor: '#1A1A1A', 
    padding: 30, 
    borderRadius: 24, 
    borderWidth: 1, 
    borderColor: '#2A2A2A', 
    elevation: 10, 
    shadowColor: '#00FFCC', 
    shadowOpacity: 0.05, 
    shadowRadius: 20, 
    shadowOffset: {width: 0, height: 10} 
  },
  header: { alignItems: 'center' },
  monoTextTny: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 10, color: '#888888', letterSpacing: 2, marginBottom: 8 },
  title: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', letterSpacing: 2 },
  partnerText: { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#888888', marginTop: 10, letterSpacing: 1 },
  divider: { height: 1, backgroundColor: '#2A2A2A', marginVertical: 24 },
  
  roleBadge: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, alignSelf: 'center', marginBottom: 25 },
  roleText: { fontSize: 11, fontWeight: '900', letterSpacing: 1, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  
  hudContainer: { backgroundColor: '#050505', padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 30 },
  hudLabel: { fontSize: 10, fontWeight: 'bold', color: '#888888', letterSpacing: 1.5, marginBottom: 8, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  hudValue: { fontSize: 14, fontWeight: 'bold', lineHeight: 22, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  
  primaryBtn: { 
    backgroundColor: '#0A0A0A', 
    paddingVertical: 18, 
    borderRadius: 12, 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#00FFCC', 
    shadowColor: '#00FFCC', 
    shadowOpacity: 0.2, 
    shadowRadius: 8, 
    shadowOffset: {width: 0, height: 0}, 
    elevation: 5 
  },
  btnText: { color: '#00FFCC', fontWeight: '900', fontSize: 13, letterSpacing: 1.5, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  
  loaderBox: { alignItems: 'center', paddingVertical: 15 },
  loaderText: { marginTop: 15, color: '#888888', fontSize: 11, fontWeight: 'bold', letterSpacing: 1, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  
  secureBox: { backgroundColor: 'rgba(0, 255, 204, 0.05)', padding: 24, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#00FFCC' },
  secureTitle: { color: '#00FFCC', fontWeight: '900', fontSize: 14, marginBottom: 15, letterSpacing: 1, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  vizBtn: { marginTop: 20, padding: 10 },
  vizBtnText: { color: '#888888', fontSize: 11, fontWeight: 'bold', letterSpacing: 1, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  
  killBtn: { marginTop: 30, alignSelf: 'center', padding: 10 },
  killBtnText: { color: '#FF3366', fontSize: 11, fontWeight: '900', letterSpacing: 1, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

  // Modal styling
  modalOverlay: { flex: 1, backgroundColor: 'rgba(10, 10, 10, 0.9)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1A1A1A', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 30, maxHeight: '85%', borderWidth: 1, borderColor: '#2A2A2A' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#FFFFFF', letterSpacing: 2 },
  closeBtn: { fontSize: 24, color: '#888888', fontWeight: 'bold' },
  
  label: { fontSize: 10, fontWeight: 'bold', color: '#888888', marginBottom: 8, marginTop: 20, letterSpacing: 1.5, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  terminalBox: { backgroundColor: '#050505', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A' },
  terminalText: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 13, color: '#00FFCC', lineHeight: 20 },
  
  infoCard: { backgroundColor: 'rgba(0, 255, 204, 0.05)', padding: 20, borderRadius: 12, marginTop: 30, borderWidth: 1, borderColor: '#2A2A2A' },
  infoTitle: { fontSize: 12, fontWeight: '900', color: '#00FFCC', marginBottom: 8, letterSpacing: 1 },
  infoText: { fontSize: 12, color: '#888888', lineHeight: 20, fontWeight: 'bold' }
});