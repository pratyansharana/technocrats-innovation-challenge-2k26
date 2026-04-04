import React, { useState, useEffect, useRef } from 'react';
import { 
  View, StyleSheet, Text, ActivityIndicator, StatusBar, KeyboardAvoidingView, 
  Platform, TouchableOpacity, Modal, ScrollView, Alert, TextInput, FlatList, Image 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeIn, withRepeat, withSequence, withTiming, useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

// Firestore & Storage Imports
import { doc, collection, onSnapshot, addDoc, updateDoc, serverTimestamp, getDocs, query, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'; 
import { db, auth, storage } from '../Firebase/FirebaseConfig'; 
import { CryptoService } from '../Services/CryptoService';
import { QuantumKeyService } from '../Services/QuantumService';

// ==========================================
// 🛡️ CONTENT MODERATION ENGINE
// ==========================================
// Add any words you want to block during your hackathon demo here
const BLOCKED_WORDS = ['hack', 'scam', 'phishing', 'malware', 'badword']; 

const containsBlockedWords = (text: string) => {
  return BLOCKED_WORDS.some(word => {
    // \b ensures we only block exact words (so blocking "ass" doesn't block "class")
    // 'i' makes it case-insensitive (blocks "SCAM", "Scam", "scam")
    const regex = new RegExp(`\\b${word}\\b`, 'i'); 
    return regex.test(text);
  });
};

export default function ChatScreen({ route, navigation }: any) {
  const { sessionId, targetUser } = route.params;
  
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  
  const [secureKey, setSecureKey] = useState<string>("");
  const [rawSiftedBits, setRawSiftedBits] = useState<number[]>([]);
  
  const [isReady, setIsReady] = useState(false);
  const [cacheLoaded, setCacheLoaded] = useState(false); 
  const [showDetails, setShowDetails] = useState(false);
  const [isRekeyingOverlay, setIsRekeyingOverlay] = useState(false);

  // Image State
  const [imageSending, setImageSending] = useState(false);
  const [decryptedImageMap, setDecryptedImageMap] = useState<Record<string, string>>({});

  const currentUser = auth.currentUser;
  const localCacheRef = useRef<Record<string, any>>({});
  const sessionStartTimeRef = useRef(new Date().getTime());
  const aliceDataRef = useRef<{ bits: any[], bases: any[] } | null>(null);
  
  const isExitingRef = useRef(false);
  const insets = useSafeAreaInsets(); 

  const pulseOpacity = useSharedValue(0.5);
  useEffect(() => {
    pulseOpacity.value = withRepeat(
      withSequence(withTiming(1, { duration: 1000 }), withTiming(0.5, { duration: 1000 })),
      -1, true
    );
  }, []);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulseOpacity.value }));

  // ==========================================
  // 1. SEQUENCE LOCK: LOAD CACHE FIRST
  // ==========================================
  useEffect(() => {
    const loadLocalHistory = async () => {
      try {
        const stored = await AsyncStorage.getItem(`chat_${sessionId}`);
        if (stored) {
          localCacheRef.current = JSON.parse(stored);
        }
      } catch (e) {
        console.error("Local Cache Load Error:", e);
      } finally {
        setCacheLoaded(true); 
      }
    };
    loadLocalHistory();
  }, [sessionId]);

  // ==========================================
  // 2. BACKGROUND BB84 AUTO-RESPONDER
  // ==========================================
  useEffect(() => {
    const sessionRef = doc(db, 'sessions', sessionId);
    
    const unsubscribe = onSnapshot(sessionRef, async (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();

      const wasAborted = data.status === 'initializing' && !!data.abortedAt;
      if (wasAborted && !isExitingRef.current) {
        isExitingRef.current = true;
        setMessages([]);
        localCacheRef.current = {};
        await AsyncStorage.removeItem(`chat_${sessionId}`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          "LINK SEVERED",
          "Your peer aborted the sequence. All keys and messages have been permanently destroyed.",
          [{ text: "Return to Directory", onPress: () => navigation.replace('Home') }],
          { cancelable: false }
        );
        return;
      }

      if (!data.handshakeComplete && data.status === 'rekeying') setIsRekeyingOverlay(true);

      if (data.status === 'rekeying' && data.quantumPayload && data.aliceId !== currentUser?.uid && !data.bobBases) {
        sessionStartTimeRef.current = Date.now(); 
        const bobBases = data.quantumPayload.map(() => Math.random() > 0.5 ? 'X' : '+');
        await updateDoc(sessionRef, { bobBases });
      }

      if (data.status === 'rekeying' && data.bobBases && data.aliceId === currentUser?.uid && !data.matchingIndexes && aliceDataRef.current) {
        const matchingIndexes = aliceDataRef.current.bases
          .map((b: string, i: number) => b === data.bobBases[i] ? i : null)
          .filter((v: number | null) => v !== null);

        await updateDoc(sessionRef, { matchingIndexes, handshakeComplete: true, status: 'secure' });
      }

      if (data.handshakeComplete && data.matchingIndexes) {
        const rawBits = data.quantumPayload;
        const indexes = data.matchingIndexes;
        const siftedBits = indexes.map((idx: number) => rawBits[idx]);
        setRawSiftedBits(siftedBits);

        const hexKey = CryptoService.formatKeyForAES(siftedBits);
        setSecureKey(hexKey);
        setIsReady(true);
        
        if (isRekeyingOverlay) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setIsRekeyingOverlay(false); 
        }
      }
    });
    return () => unsubscribe();
  }, [sessionId, currentUser, isRekeyingOverlay, isReady]);

  // ==========================================
  // 3. LISTEN FOR MESSAGES (FIRESTORE)
  // ==========================================
  useEffect(() => {
    if (!secureKey || !cacheLoaded) return;

    const messagesRef = collection(db, 'sessions', sessionId, 'messages');
    
    const unsubscribe = onSnapshot(messagesRef, (snapshot) => {
      if (isExitingRef.current) return; 

      const serverData: Record<string, any> = {};
      snapshot.forEach((docSnap) => {
        serverData[docSnap.id] = docSnap.data();
      });
      
      let cacheUpdated = false;
      const serverKeys = Object.keys(serverData);
      const cacheKeys = Object.keys(localCacheRef.current);
      const allUniqueKeys = Array.from(new Set([...serverKeys, ...cacheKeys]));

      const chatMessages: any[] = allUniqueKeys.map((key) => {
        if (localCacheRef.current[key]) {
          const cachedMsg = localCacheRef.current[key];
          return { ...cachedMsg, createdAt: new Date(cachedMsg.createdAt) };
        }

        const msg = serverData[key];
        if (!msg) return null; 

        let decryptedText = "[ DECRYPTION FAILED ]";
        let isLegacy = true;

        try {
          if (msg.messageType === 'image') {
            decryptedText = "[ ENCRYPTED IMAGE ]"; 
            isLegacy = false; 
          } else {
            decryptedText = CryptoService.decryptMessage(msg.text, secureKey);
            isLegacy = decryptedText.includes("Error") || !decryptedText;
          }
        } catch (err) {}

        let validDate = new Date();
        if (msg.createdAt) {
          if (msg.createdAt.toDate) validDate = msg.createdAt.toDate();
          else if (typeof msg.createdAt === 'number' || typeof msg.createdAt === 'string') validDate = new Date(msg.createdAt);
        }

        const processedMsg = {
          _id: key,
          text: isLegacy ? "[ ENCRYPTED ARCHIVE: Sealed by previous session key ]" : decryptedText,
          messageType: msg.messageType || 'text',
          storageUrl: msg.storageUrl,
          createdAt: validDate,
          user: { _id: msg.user._id, name: msg.user.name },
          system: false,
          isLegacy: isLegacy 
        };

        if (!isLegacy && msg.messageType !== 'image') {
          localCacheRef.current[key] = processedMsg;
          cacheUpdated = true;
        }

        return processedMsg;
      }).filter(Boolean);

      if (cacheUpdated) AsyncStorage.setItem(`chat_${sessionId}`, JSON.stringify(localCacheRef.current));

      chatMessages.push({
        _id: `system-key-${secureKey.substring(0, 8)}`,
        text: `[ SYS.MSG ] NEW QUANTUM KEY ESTABLISHED\nMessages below are secured with Ephemeral AES-256.\nKEY_ID: ${secureKey.substring(0, 6)}...`,
        messageType: 'text',
        createdAt: new Date(sessionStartTimeRef.current),
        system: true,
        user: { _id: 'system', name: 'System' }
      });

      chatMessages.sort((a, b) => (b.createdAt as any) - (a.createdAt as any));
      setMessages(chatMessages);
    });

    return () => unsubscribe();
  }, [secureKey, cacheLoaded, sessionId]);

  // ==========================================
  // 3.5. ASYNC DECRYPT IMAGES FROM STORAGE
  // ==========================================
  useEffect(() => {
    const loadStoredImages = async () => {
      if (!secureKey) return;

      const imageMessages = messages.filter(msg => 
        msg.messageType === 'image' && 
        msg.storageUrl && 
        !decryptedImageMap[msg._id] &&
        !msg.isLegacy
      );

      if (imageMessages.length === 0) return;

      const nextMap: Record<string, string> = {};

      await Promise.all(imageMessages.map(async (msg) => {
        try {
          const response = await fetch(msg.storageUrl);
          const encryptedPayload = await response.text();
          const decrypted = CryptoService.decryptMessage(encryptedPayload, secureKey);

          if (decrypted && !decrypted.includes("Error")) {
             nextMap[msg._id] = decrypted;
          }
        } catch (error) {
          console.error('Failed to load encrypted image payload:', error);
        }
      }));

      if (Object.keys(nextMap).length > 0) {
        setDecryptedImageMap(prev => ({ ...prev, ...nextMap }));
      }
    };

    loadStoredImages();
  }, [messages, secureKey]);

  // ==========================================
  // 4. INSTANT IN-CHAT REKEY
  // ==========================================
  const handleRekey = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Instant Rekey",
      "Generate a new quantum key? Both devices will automatically renegotiate the connection.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Rekey Now", style: "destructive", 
          onPress: async () => {
            setIsRekeyingOverlay(true);
            const result = await QuantumKeyService.generateAndTransmit(256, false);
            if (result.success) {
              aliceDataRef.current = { bits: result.aliceBits, bases: result.aliceBases };
              sessionStartTimeRef.current = Date.now(); 
              await updateDoc(doc(db, 'sessions', sessionId), {
                handshakeComplete: false, quantumPayload: result.photonsForBob, bobBases: null,
                matchingIndexes: null, aliceId: currentUser?.uid, status: 'rekeying'
              });
            } else {
              setIsRekeyingOverlay(false);
              Alert.alert("Error", "Quantum API failed to respond.");
            }
          }
        }
      ]
    );
  };

  // ==========================================
  // 5. ABORT SEQUENCE (SCORCHED EARTH)
  // ==========================================
  const handleAbortSequence = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      "INITIATE ABORT SEQUENCE",
      "This will permanently sever the quantum link, wipe local memory, and DELETE ALL MESSAGES from the cloud. Proceed?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "BURN EVERYTHING", style: "destructive", 
          onPress: async () => {
            if (!currentUser || isExitingRef.current) return;
            isExitingRef.current = true;
            
            try {
              setMessages([]);
              localCacheRef.current = {};
              await AsyncStorage.removeItem(`chat_${sessionId}`);
              
              const messagesRef = collection(db, 'sessions', sessionId, 'messages');
              const snapshot = await getDocs(query(messagesRef));
              if (!snapshot.empty) {
                const deletePromises = snapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
                await Promise.all(deletePromises); 
              }
              
              await updateDoc(doc(db, 'sessions', sessionId), {
                handshakeComplete: false, quantumPayload: null, bobBases: null, matchingIndexes: null,
                aliceId: null, status: 'initializing', abortedAt: new Date().toISOString(), abortedBy: currentUser.uid
              });

              navigation.replace('Home');
            } catch (error) {
              console.error('Abort cleanup failed:', error);
              Alert.alert("Error", "Check your connection. Deletion may have partially failed.");
              isExitingRef.current = false;
            }
          }
        }
      ]
    );
  };

  // ==========================================
  // 6. CUSTOM SEND MESSAGE HANDLER
  // ==========================================
  // ==========================================
  // 6. CUSTOM SEND MESSAGE HANDLER
  // ==========================================
  const handleSend = async () => {
    if (!inputText.trim() || !secureKey || !currentUser) return;

    // 🔥 THE FIX: Check for blocked words before encrypting
    if (containsBlockedWords(inputText)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Transmission Blocked", 
        "Your message contains prohibited keywords and violates network policy."
      );
      return; // 🛑 This immediately stops the message from sending
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const textToSend = inputText.trim();
    setInputText("");
    
    const encryptedText = CryptoService.encryptMessage(textToSend, secureKey);
    const messagesRef = collection(db, 'sessions', sessionId, 'messages');
    
    await addDoc(messagesRef, {
      text: encryptedText,
      messageType: 'text',
      createdAt: serverTimestamp(),
      user: { _id: currentUser.uid, name: currentUser.displayName || "User" },
    });
  };

  // ==========================================
  // 7. SECURE IMAGE SENDER (BULLETPROOF UPLOAD)
  // ==========================================

  const handleSendImage = async () => {
    if (!secureKey || !currentUser) return;

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission Required", "Allow camera roll access to send secure photos.");
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      // 🔥 FIX 1: Updated to the new Expo array syntax
      mediaTypes: ['images'], 
      quality: 1, 
    });

    if (pickerResult.canceled) return;
    
    setImageSending(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      // 1. Compress Image
      const compressedImage = await ImageManipulator.manipulateAsync(
        pickerResult.assets[0].uri,
        [{ resize: { width: 1024 } }], 
        { compress: 0.8, base64: true }
      );

      const mimeType = 'image/jpeg';
      const dataUrl = `data:${mimeType};base64,${compressedImage.base64}`;

      // 2. Encrypt locally
      const encryptedImageText = CryptoService.encryptMessage(dataUrl, secureKey);

      // 3. Write the giant string to a temp file, then fetch it as a Blob
      const tempUri = FileSystem.cacheDirectory + `temp_enc_${Date.now()}.txt`;
      
      // 🔥 FIX 2: Removed the { encoding } object entirely. It defaults to UTF8 safely.
      await FileSystem.writeAsStringAsync(tempUri, encryptedImageText);
      
      const response = await fetch(tempUri);
      const blob = await response.blob();

      // 4. Upload Blob to Firebase Storage
      const storagePath = `encrypted-images/${sessionId}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.enc`;
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, blob, { contentType: 'text/plain' });
      
      // Cleanup the temp file to save phone space
      await FileSystem.deleteAsync(tempUri, { idempotent: true });

      const storageUrl = await getDownloadURL(storageRef);

      // 5. Save metadata to Firestore
      const messagesRef = collection(db, 'sessions', sessionId, 'messages');
      await addDoc(messagesRef, {
        text: '[encrypted-image-storage]',
        messageType: 'image',
        mimeType: mimeType,
        encrypted: true,
        storagePath,
        storageUrl,
        createdAt: serverTimestamp(),
        user: { _id: currentUser.uid, name: currentUser.displayName || "User" },
      });

    } catch (error) {
      console.error("Image send error:", error);
      Alert.alert("Error", "Failed to encrypt and send image.");
    } finally {
      setImageSending(false);
    }
  };

  // ==========================================
  // 🎨 CUSTOM MESSAGE BUBBLE RENDERER
  // ==========================================
  const renderMessageItem = ({ item }: { item: any }) => {
    const isMe = item.user._id === currentUser?.uid;
    const isSystem = item.system;
    const isLegacy = item.isLegacy;

    if (isSystem) {
      return (
        <View style={styles.systemMsgContainer}>
          <View style={styles.systemMsgBox}>
            <Text style={styles.systemMsgText}>{item.text}</Text>
          </View>
        </View>
      );
    }

    let timeString = '';
    if (item.createdAt instanceof Date) {
      timeString = item.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    return (
      <View style={[styles.messageWrapper, isMe ? styles.messageWrapperRight : styles.messageWrapperLeft]}>
        <View style={[
          styles.bubble,
          isMe ? styles.bubbleRight : styles.bubbleLeft,
          isLegacy && (isMe ? styles.bubbleRightLegacy : styles.bubbleLeftLegacy)
        ]}>
          
          {/* IMAGE RENDERER */}
          {item.messageType === 'image' ? (
            decryptedImageMap[item._id] ? (
              <Image 
                source={{ uri: decryptedImageMap[item._id] }} 
                style={{ width: 220, height: 220, borderRadius: 8, marginVertical: 5 }} 
              />
            ) : (
              <View style={styles.imageLoadingBox}>
                <ActivityIndicator color={isMe ? "#1A1A1A" : "#00FFCC"} />
                <Text style={[styles.timeText, { marginTop: 8, color: isMe ? "#1A1A1A" : "#00FFCC" }]}>
                  {isLegacy ? 'ARCHIVED' : 'DECRYPTING...'}
                </Text>
              </View>
            )
          ) : (
            <Text style={[
              styles.messageText,
              isMe ? styles.messageTextRight : styles.messageTextLeft,
              isLegacy && styles.messageTextLegacy
            ]}>
              {item.text}
            </Text>
          )}

          <Text style={[styles.timeText, isMe ? styles.timeTextRight : styles.timeTextLeft]}>
            {timeString}
          </Text>
        </View>
      </View>
    );
  };

  if (!isReady || !cacheLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00FFCC" />
        <Text style={styles.loadingText}>SYNCHRONIZING QKD ENDPOINTS...</Text>
      </View>
    );
  }

  // ==========================================
  // 🔥 THE BULLETPROOF CUSTOM LAYOUT
  // ==========================================
  return (
    <View style={styles.mainWrapper}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
      >
        
        {/* HEADER */}
        <Animated.View entering={FadeInUp.duration(400)} style={{ paddingTop: insets.top }}>
          <View style={styles.headerContainer}>
            <TouchableOpacity style={styles.headerLeft} onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowDetails(true);
            }} activeOpacity={0.7}>
              <Animated.View style={[styles.pulseDot, pulseStyle]} />
              <View>
                <Text style={styles.headerText}>END-TO-END SECURED</Text>
                <Text style={styles.headerSubtext}>TAP FOR METRICS</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.headerButtons}>
              <TouchableOpacity style={styles.rekeyBtn} onPress={handleRekey} activeOpacity={0.7}>
                 <Text style={styles.rekeyBtnText}>[ REKEY ]</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.abortBtn} onPress={handleAbortSequence} activeOpacity={0.7}>
                 <Text style={styles.abortBtnText}>[ ERASE ]</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* CHAT LIST */}
        <FlatList
          inverted
          data={messages}
          keyExtractor={(item) => item._id}
          renderItem={renderMessageItem}
          contentContainerStyle={styles.flatListContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />

        {/* INPUT AREA */}
        <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 15) }]}>
          
          <TouchableOpacity 
            onPress={handleSendImage} 
            disabled={imageSending || !inputText.trim() === false} 
            style={styles.cameraBtn}
          >
            {imageSending ? (
               <ActivityIndicator size="small" color="#00FFCC" />
            ) : (
               <Text style={[styles.cameraIcon, inputText.length > 0 && { opacity: 0.3 }]}>📷</Text>
            )}
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder={imageSending ? "Encrypting image..." : "Secure transmission..."}
            placeholderTextColor="#888888"
            editable={!imageSending}
            multiline
            maxLength={500}
          />
          <TouchableOpacity 
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]} 
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Text style={[styles.sendIcon, !inputText.trim() && styles.sendIconDisabled]}>➔</Text>
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>

      {/* OVERLAYS & MODALS */}
      {isRekeyingOverlay && (
        <Animated.View entering={FadeIn} style={styles.rekeyOverlay}>
          <View style={styles.rekeyOverlayBox}>
            <ActivityIndicator size="large" color="#00FFCC" />
            <Text style={styles.rekeyOverlayTitle}>NEGOTIATING KEY</Text>
            <Text style={styles.rekeyOverlaySub}>EXCHANGING PHOTONS VIA BB84...</Text>
          </View>
        </Animated.View>
      )}

      <Modal visible={showDetails} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>QKD VERIFICATION</Text>
              <TouchableOpacity onPress={() => setShowDetails(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>ACTIVE SESSION KEY (AES-256)</Text>
              <View style={styles.terminalBox}>
                <Text style={styles.terminalText}>{secureKey}</Text>
              </View>
              
              <Text style={styles.label}>SIFTED PHOTON BITS ({rawSiftedBits.length})</Text>
              <View style={styles.terminalBox}>
                <Text style={styles.terminalText}>{rawSiftedBits.join('')}</Text>
              </View>
              
              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>[ FORWARD SECRECY ACTIVE ]</Text>
                <Text style={styles.infoText}>
                  Your connection is shielded by an ephemeral key. When this channel closes, the encryption material is permanently burned. 
                </Text>
              </View>

              <TouchableOpacity style={{marginTop: 40, padding: 10}} onPress={async () => {
                 await AsyncStorage.removeItem(`chat_${sessionId}`);
                 Alert.alert("Cache Wiped", "Please restart the chat to see effects.");
              }}>
                 <Text style={{color: '#FF3366', fontWeight: '900', fontSize: 11, textAlign: 'center', letterSpacing: 1, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'}}>DEV: WIPE DEVICE CACHE</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: { flex: 1, backgroundColor: '#0A0A0A' }, 
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0A0A' },
  loadingText: { marginTop: 15, color: '#00FFCC', fontSize: 11, fontWeight: '900', letterSpacing: 1.5, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  
  headerContainer: { flexDirection: 'row', backgroundColor: '#0A0A0A', paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'space-between', elevation: 10, shadowColor: '#00FFCC', shadowOpacity: 0.1, shadowRadius: 10, borderBottomWidth: 1, borderBottomColor: '#1A1A1A', zIndex: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  pulseDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#00FFCC', marginRight: 12, shadowColor: '#00FFCC', shadowOpacity: 0.8, shadowRadius: 6 },
  headerText: { fontSize: 12, color: '#00FFCC', fontWeight: '900', letterSpacing: 1.5, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  headerSubtext: { fontSize: 9, color: '#888888', fontWeight: 'bold', letterSpacing: 1.5, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  rekeyBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#1A1A1A', borderRadius: 8, borderWidth: 1, borderColor: '#2A2A2A' },
  rekeyBtnText: { color: '#00FFCC', fontSize: 10, fontWeight: '900', letterSpacing: 1, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

  headerButtons: { flexDirection: 'row', gap: 8 },
  abortBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#1A1A1A', borderRadius: 8, borderWidth: 1, borderColor: '#FF3366' },
  abortBtnText: { color: '#FF3366', fontSize: 10, fontWeight: '900', letterSpacing: 1, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  
  flatListContent: { paddingHorizontal: 15, paddingVertical: 20, gap: 10 },
  messageWrapper: { width: '100%', marginBottom: 8 },
  messageWrapperRight: { alignItems: 'flex-end' },
  messageWrapperLeft: { alignItems: 'flex-start' },
  
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1 },
  bubbleRight: { backgroundColor: '#00FFCC', borderRadius: 16, borderBottomRightRadius: 4, borderColor: '#00FFCC', shadowColor: '#00FFCC', shadowOpacity: 0.2, shadowRadius: 5 },
  bubbleLeft: { backgroundColor: '#1A1A1A', borderRadius: 16, borderBottomLeftRadius: 4, borderColor: '#2A2A2A' },
  bubbleRightLegacy: { backgroundColor: '#1A1A1A', borderColor: '#2A2A2A', shadowOpacity: 0 },
  bubbleLeftLegacy: { backgroundColor: '#111111', borderColor: '#2A2A2A', opacity: 0.8 },

  messageText: { fontSize: 15, lineHeight: 22 },
  messageTextRight: { color: '#0A0A0A', fontWeight: '700' },
  messageTextLeft: { color: '#FFFFFF', fontWeight: '500' },
  messageTextLegacy: { color: '#888888', fontStyle: 'italic' },
  
  imageLoadingBox: { width: 220, height: 220, borderRadius: 8, marginVertical: 5, backgroundColor: 'rgba(0,0,0,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.2)' },

  timeText: { fontSize: 10, marginTop: 4, fontWeight: '700', alignSelf: 'flex-end' },
  timeTextRight: { color: 'rgba(0,0,0,0.5)' },
  timeTextLeft: { color: '#888888' },

  systemMsgContainer: { alignItems: 'center', marginVertical: 20, width: '100%' },
  systemMsgBox: { backgroundColor: '#1A1A1A', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A' },
  systemMsgText: { color: '#888888', fontSize: 10, fontWeight: 'bold', textAlign: 'center', lineHeight: 16, letterSpacing: 1, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

  inputContainer: { flexDirection: 'row', backgroundColor: '#0A0A0A', borderTopWidth: 1, borderTopColor: '#1A1A1A', paddingHorizontal: 15, paddingTop: 10, alignItems: 'flex-end' },
  cameraBtn: { marginBottom: 12, marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  cameraIcon: { fontSize: 22 },
  textInput: { flex: 1, backgroundColor: '#1A1A1A', color: '#FFFFFF', minHeight: 45, maxHeight: 120, borderRadius: 20, borderWidth: 1, borderColor: '#2A2A2A', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontSize: 15, marginRight: 10 },
  sendBtn: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#00FFCC', justifyContent: 'center', alignItems: 'center', shadowColor: '#00FFCC', shadowOpacity: 0.3, shadowRadius: 5 },
  sendBtnDisabled: { borderColor: '#2A2A2A', shadowOpacity: 0 },
  sendIcon: { color: '#00FFCC', fontSize: 18, fontWeight: 'bold', marginLeft: 2 },
  sendIconDisabled: { color: '#555555' },
  
  rekeyOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10, 10, 10, 0.95)', zIndex: 1000, justifyContent: 'center', alignItems: 'center' },
  rekeyOverlayBox: { backgroundColor: '#1A1A1A', padding: 35, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#00FFCC', shadowColor: '#00FFCC', shadowOpacity: 0.2, shadowRadius: 30 },
  rekeyOverlayTitle: { color: '#00FFCC', fontSize: 16, fontWeight: '900', letterSpacing: 2, marginTop: 25, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  rekeyOverlaySub: { color: '#888888', fontSize: 11, marginTop: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', letterSpacing: 1.5 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(10, 10, 10, 0.9)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1A1A1A', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 35, maxHeight: '85%', borderWidth: 1, borderColor: '#2A2A2A', shadowColor: '#00FFCC', shadowOpacity: 0.1, shadowRadius: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#FFFFFF', letterSpacing: 2 },
  closeBtn: { fontSize: 26, color: '#888888', fontWeight: 'bold' },
  label: { fontSize: 10, fontWeight: 'bold', color: '#888888', marginBottom: 10, marginTop: 25, letterSpacing: 1.5, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  terminalBox: { backgroundColor: '#050505', padding: 18, borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A' },
  terminalText: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 13, color: '#00FFCC', lineHeight: 22 },
  infoCard: { backgroundColor: '#050505', padding: 24, borderRadius: 16, marginTop: 35, borderWidth: 1, borderColor: '#2A2A2A' },
  infoTitle: { fontSize: 13, fontWeight: '900', color: '#00FFCC', marginBottom: 10, letterSpacing: 1.5 },
  infoText: { fontSize: 13, color: '#888888', lineHeight: 22, fontWeight: 'bold' }
});