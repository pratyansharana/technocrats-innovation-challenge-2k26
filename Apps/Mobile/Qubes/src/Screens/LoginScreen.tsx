import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  Dimensions, 
  FlatList, 
  Animated,
  StatusBar,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthService } from '../Services/FirebaseAuthService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    heading: 'Quantum\nSecure',
    description: 'Quantum Key Distribution  BB84. Your messages are Quantum protected against future threats.',
    icon: '🛡️',
  },
  {
    id: '2',
    heading: 'Zero\nTrace',
    description: 'Perfect forward secrecy. Ephemeral keys ensure that once a message is gone, it is gone forever.',
    icon: '👻',
  },
  {
    id: '3',
    heading: 'Absolute\nPrivacy',
    description: 'No data harvesting. No metadata tracking. Your identity is a cryptographic seed known only to you.',
    icon: '🔑',
  },
];

const QubesLoginScreen = ({ navigation }: any) => {
  const [loading, setLoading] = useState(false);
  const scrollX = useRef(new Animated.Value(0)).current;

  
  const colors = {
    background: '#0A0A0A', 
    text: '#FFFFFF',
    textSecondary: '#888888',
    primary: '#00FFCC',    
    surface: '#1A1A1A',
  };

const handleLogin = async () => {
    setLoading(true);
    
    try {
      const user = await AuthService.signInWithGoogle();
      if (user) {
        navigation?.navigate('Home'); 
      }
    } catch (error: any) {
      console.error("Login sequence aborted:", error);
      
      Alert.alert(
        "Connection Failed", 
        "Could not establish a secure quantum node. Please try again."
      );
    } finally {
      
      setLoading(false);
    }
  };

  const renderSlide = ({ item }: { item: typeof SLIDES[0] }) => (
    <View style={styles.slide}>
      <View style={styles.heroSection}>
        <Text style={[styles.mainHeading, { color: colors.text }]}>{item.heading}</Text>
        
        <View style={styles.iconContainer}>
          <Text style={styles.emojiIcon}>{item.icon}</Text>
          <View style={[styles.dash, styles.dashTL, { borderColor: colors.primary }]} />
          <View style={[styles.dash, styles.dashBR, { borderColor: colors.primary }]} />
        </View>
      </View>

      <View style={styles.bodySection}>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {item.description}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.mainContainer, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <Text style={[styles.logoText, { color: colors.text }]}>QUBES</Text>
        <View style={styles.statusDot} />
      </View>

      <FlatList
        data={SLIDES}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        keyExtractor={(item) => item.id}
        scrollEventThrottle={16}
        bounces={false}
      />

      <View style={styles.footer}>
        <View style={styles.pagination}>
          {SLIDES.map((_, i) => {
            const inputRange = [(i - 1) * SCREEN_WIDTH, i * SCREEN_WIDTH, (i + 1) * SCREEN_WIDTH];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 22, 8],
              extrapolate: 'clamp',
            });
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });

            return (
              <Animated.View 
                key={i} 
                style={[
                  styles.dot, 
                  { 
                    width: dotWidth, 
                    opacity, 
                    backgroundColor: colors.primary 
                  }
                ]} 
              />
            );
          })}
        </View>

        <View style={styles.actionSection}>
          <TouchableOpacity 
            style={[styles.loginButton, { backgroundColor: colors.primary }]} 
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <View style={styles.buttonInner}>
                <Text style={styles.buttonText}>
                  Login With Google
                </Text>
                <Text style={styles.chevronIcon}> ➔</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.signUpRow}>
            <Text style={[styles.signUpText, { color: colors.textSecondary }]}>
              Made in INDIA.{' '}
            </Text>
            <TouchableOpacity onPress={() => navigation?.navigate('Restore')}>
              <Text style={[styles.signUpLink, { color: colors.primary }]}>
                
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  mainContainer: { flex: 1 },
  header: { 
    width: '100%', 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10
  },
  logoText: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00FFCC',
    marginLeft: 8,
    shadowColor: '#00FFCC',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  slide: { width: SCREEN_WIDTH, paddingHorizontal: 30 },
  heroSection: { 
    alignItems: 'flex-start', 
    marginTop: 20, 
    minHeight: SCREEN_HEIGHT * 0.40 
  },
  mainHeading: { 
    fontSize: 54, 
    fontWeight: 'bold', 
    lineHeight: 60, 
    marginBottom: 40, 
    letterSpacing: -1 
  },
  iconContainer: { 
    width: '100%', 
    alignItems: 'center', 
    justifyContent: 'center', 
    position: 'relative',
    marginTop: 10
  },
  emojiIcon: {
    fontSize: 90,
  },
  dash: { 
    position: 'absolute', 
    width: 24, 
    height: 24, 
    borderStyle: 'dashed', 
    borderWidth: 1.5, 
    borderRadius: 6 
  },
  dashTL: { top: -15, left: '25%', transform: [{ rotate: '-15deg' }] },
  dashBR: { bottom: -10, right: '25%', transform: [{ rotate: '15deg' }] },
  bodySection: { width: '100%', marginTop: 20 },
  description: { 
    fontSize: 18, 
    lineHeight: 28, 
    paddingRight: 30, 
    fontWeight: '400' 
  },
  footer: { paddingHorizontal: 30, paddingBottom: 50 },
  pagination: { flexDirection: 'row', marginBottom: 40, alignItems: 'center' },
  dot: { height: 8, borderRadius: 4, marginHorizontal: 4 },
  actionSection: { width: '100%', alignItems: 'flex-start' },
  loginButton: { 
    paddingVertical: 18, 
    paddingHorizontal: 30, 
    borderRadius: 14, 
    marginBottom: 25, 
    width: '100%',
    shadowColor: "#00FFCC",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  buttonInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontWeight: 'bold', fontSize: 18, color: '#000000' },
  chevronIcon: { fontWeight: 'bold', fontSize: 18, marginLeft: 4, color: '#000000' },
  signUpRow: { flexDirection: 'row', alignItems: 'center', marginLeft: 5 },
  signUpText: { fontSize: 15, fontWeight: '500' },
  signUpLink: { fontSize: 15, fontWeight: 'bold' }
});

export default QubesLoginScreen;