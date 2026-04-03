import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert, 
  FlatList, 
  ActivityIndicator,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthService } from '../Services/FirebaseAuthService';
import { db, auth } from '../Firebase/FirebaseConfig'; 
import { collection, getDocs } from 'firebase/firestore';

export default function HomeScreen({ navigation }: any) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // QUBES Theme Colors
  const colors = {
    background: '#0A0A0A',
    text: '#FFFFFF',
    textSecondary: '#888888',
    primary: '#00FFCC',
    surface: '#1A1A1A',
    border: '#2A2A2A',
    danger: '#FF3366'
  };

  useEffect(() => {
    fetchAvailableUsers();
  }, []);

  const fetchAvailableUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const fetchedUsers: any[] = [];
      
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        if (userData.uid !== auth.currentUser?.uid) {
          fetchedUsers.push(userData);
        }
      });
      
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Error fetching secure nodes:", error);
      Alert.alert("Network Error", "Could not fetch active quantum nodes.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await AuthService.signOut();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to disconnect secure node properly.');
    }
  };

  const renderUserItem = ({ item }: any) => {
    const displayName = item.displayName || item.email?.split('@')[0] || 'Unknown Node';
    const initial = displayName.charAt(0).toUpperCase();

    return (
      <TouchableOpacity 
        style={styles.chatItemContainer}
        onPress={() => {
          navigation.navigate('Handshake', { user: item });
        }}
        activeOpacity={0.7}
      >
        <View style={[styles.avatar, { borderColor: colors.primary }]}>
          <Text style={styles.avatarText}>{initial}</Text>
          <View style={styles.onlineBadge} />
        </View>

        <View style={styles.chatDetails}>
          <Text style={styles.chatName}>{displayName}</Text>
          <Text style={styles.chatEmail}>{item.email}</Text>
        </View>

        <Text style={styles.connectIcon}>💬</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.mainContainer, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logoText}>QUBES</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.subHeaderText}>NETWORK ACTIVE</Text>
          </View>
        </View>
        
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutIcon}>Log Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actionsContainer}>
        
      </View>


      <View style={styles.listHeaderContainer}>
        <Text style={styles.listHeaderTitle}>AVAILABLE SECURE NODES</Text>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Scanning frequencies...</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.uid || item.email}
          renderItem={renderUserItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📡</Text>
              <Text style={styles.emptyText}>No other secure nodes found on this network.</Text>
            </View>
          }
        />
      )}
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
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 20,
  },
  logoText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00FFCC',
    marginRight: 6,
    shadowColor: '#00FFCC',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  subHeaderText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#00FFCC',
    letterSpacing: 2,
  },
  logoutBtn: {
    backgroundColor: '#1A1A1A',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  logoutIcon: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  actionsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00FFCC',
    shadowColor: '#00FFCC',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  actionButtonIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  listHeaderContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  listHeaderTitle: {
    color: '#888888',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    paddingTop: 10,
  },
  chatItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#1A1A1A',
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    position: 'relative',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00FFCC',
    borderWidth: 2,
    borderColor: '#0A0A0A',
  },
  chatDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  chatName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  chatEmail: {
    color: '#888888',
    fontSize: 13,
  },
  connectIcon: {
    fontSize: 20,
    opacity: 0.8,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#00FFCC',
    marginTop: 15,
    fontSize: 12,
    letterSpacing: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 50,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 15,
  },
  emptyText: {
    color: '#888888',
    fontSize: 14,
    textAlign: 'center',
  }
});