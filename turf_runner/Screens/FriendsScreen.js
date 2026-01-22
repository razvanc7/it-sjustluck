import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, TextInput, Modal, StatusBar, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { neighborhoods } from '../data/neighborhoods';
import Theme, { Colors, Avatar } from '../components/Theme';

const getAuthHeaders = async () => {
    const token = await AsyncStorage.getItem('userToken');
    return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : null;
};

const FriendsScreen = () => {
  const [friends, setFriends] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [friendDetails, setFriendDetails] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newFriendName, setNewFriendName] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchData = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    
    const token = await AsyncStorage.getItem('userToken');
    if (!token) {
        setLoading(false);
        setRefreshing(false);
        return;
    }
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    try {
      const [friendsRes, requestsRes] = await Promise.all([
        fetch('http://10.0.2.2:3000/friends', { method: 'GET', headers }),
        fetch('http://10.0.2.2:3000/friends/requests', { method: 'GET', headers })
      ]);

      const friendsData = await friendsRes.json();
      const requestsData = await requestsRes.json();

      if (friendsRes.ok) setFriends(friendsData);
      if (requestsRes.ok) setRequests(requestsData);

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData(true);
    }, [fetchData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(false);
  };

  const handleAddFriend = async () => {
    if (!newFriendName.trim()) {
      return Alert.alert('Error', 'Please enter a username.');
    }
    
    setAdding(true);
    const headers = await getAuthHeaders();
    if (!headers) return setAdding(false);

    try {
      const response = await fetch('http://10.0.2.2:3000/friends', {
        method: 'POST',
        headers,
        body: JSON.stringify({ friend_name: newFriendName }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Success', data.message || 'Friend request sent!');
        setNewFriendName('');
        fetchData(); 
      } else {
        Alert.alert('Error', data.error || 'Sending request failed.');
      }
    } catch (error) {
      Alert.alert('Network Error', 'Could not send request.');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteFriend = (friendId, friendName) => {
    Alert.alert(
      "Unfriend",
      `Remove ${friendName} from friends?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Remove", 
          style: "destructive", 
          onPress: async () => {
            const headers = await getAuthHeaders();
            if (!headers) return;
            try {
              const response = await fetch(`http://10.0.2.2:3000/friends/${friendId}`, { method: 'DELETE', headers });
              if (response.ok) fetchData(); 
              else Alert.alert('Error', 'Deletion failed.');
            } catch (error) {
              Alert.alert('Network Error', 'Could not delete friend.');
            }
          } 
        }
      ]
    );
  };
  
  const handleRequestAction = async (senderId, senderName, action) => {
    const headers = await getAuthHeaders();
    if (!headers) return;
    const endpoint = action === 'accept' ? 'accept' : 'reject';

    try {
      const response = await fetch(`http://10.0.2.2:3000/friends/${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(action === 'accept' ? { sender_id: senderId } : { target_id: senderId }),
      });

      if (response.ok) {
        fetchData();
      } else {
        Alert.alert('Error', `Action failed.`);
      }
    } catch (error) {
      Alert.alert('Network Error', 'Connection error.');
    }
  };

  const handleFriendPress = async (friendId) => {
    const headers = await getAuthHeaders();
    if (!headers) return;

    try {
      const resp = await fetch(`http://10.0.2.2:3000/friends/${friendId}/details`, { method: 'GET', headers });
      const data = await resp.json();
      if (!resp.ok) return Alert.alert('Error', data.error);

      const owned = (data.owned_neighborhoods || []).map(n => {
        const meta = neighborhoods.find(nb => nb.id === n.neighborhood_id) || { name: n.neighborhood_id };
        return { id: n.neighborhood_id, name: meta.name, max_steps: n.max_steps, captured_at: n.captured_at };
      });

      setFriendDetails({ ...data, owned_neighborhoods: owned });
      setModalVisible(true);
    } catch (err) {
      Alert.alert('Network Error', 'Could not fetch details');
    }
  };

  if (loading) {
     return (
        <View style={[styles.container, styles.center]}>
            <ActivityIndicator size="large" color={Colors.accent} />
        </View>
     );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      
      <View style={styles.header}>
        <Text style={styles.title}>Friends</Text>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} colors={[Colors.accent]} />
        }
      >
        {/* Add Friend Section */}
        <View style={styles.searchContainer}>
            <Icon name="search-outline" size={20} color={Colors.muted} style={{ marginLeft: 12 }} />
            <TextInput
                style={styles.searchInput}
                placeholder="Find users by username..." 
                placeholderTextColor={Colors.muted}
                value={newFriendName}
                onChangeText={setNewFriendName}
                autoCapitalize="none"
            />
            <TouchableOpacity 
                style={[styles.addButton, !newFriendName.trim() && { opacity: 0.5 }]} 
                onPress={handleAddFriend}
                disabled={adding || !newFriendName.trim()}
            >
                {adding ? <ActivityIndicator size="small" color="#04263a" /> : <Icon name="person-add" size={18} color="#04263a" />}
            </TouchableOpacity>
        </View>

        {/* Requests Section */}
        {requests.length > 0 && (
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Friend Requests ({requests.length})</Text>
                {requests.map((req) => (
                    <View key={req.sender_id} style={styles.requestCard}>
                        <View style={styles.userInfo}>
                            <Avatar name={req.sender_name} size={42} />
                            <View style={{ marginLeft: 12 }}>
                                <Text style={styles.userName}>{req.sender_name}</Text>
                                <Text style={styles.userEmail}>{req.sender_email}</Text>
                            </View>
                        </View>
                        <View style={styles.actionButtons}>
                            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: 'rgba(39, 174, 96, 0.2)' }]} onPress={() => handleRequestAction(req.sender_id, req.sender_name, 'accept')}>
                                <Icon name="checkmark" size={18} color="#27ae60" />
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]} onPress={() => handleRequestAction(req.sender_id, req.sender_name, 'reject')}>
                                <Icon name="close" size={18} color={Colors.danger} />
                            </TouchableOpacity>
                        </View>
                    </View>
                ))}
            </View>
        )}

        {/* Friend List Section */}
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Friends ({friends.length})</Text>
            {friends.length === 0 ? (
                <View style={styles.emptyState}>
                    <Icon name="people-outline" size={48} color={Colors.card} />
                    <Text style={styles.emptyText}>No friends yet. Add some!</Text>
                </View>
            ) : (
                friends.map((friend) => (
                    <TouchableOpacity key={friend.id} style={styles.friendRow} onPress={() => handleFriendPress(friend.id)}>
                        <View style={styles.userInfo}>
                             <Avatar name={friend.name} size={46} />
                             <View style={{ marginLeft: 14 }}>
                                 <Text style={styles.userName}>{friend.name}</Text>
                                 <Text style={styles.userEmail}>{friend.email}</Text>
                             </View>
                        </View>
                        <TouchableOpacity style={styles.moreBtn} onPress={() => handleDeleteFriend(friend.id, friend.name)}>
                             <Icon name="trash-outline" size={20} color={Colors.muted} />
                        </TouchableOpacity>
                    </TouchableOpacity>
                ))
            )}
        </View>
      </ScrollView>

       {/* Details Modal */}
      <Modal visible={modalVisible} animationType="fade" transparent={true} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                {friendDetails && (
                    <>
                        <View style={styles.modalHeader}>
                            <Avatar name={friendDetails.name} size={64} color={friendDetails.color} />
                            <View style={{ alignItems: 'center', marginTop: 12 }}>
                                <Text style={styles.modalTitle}>{friendDetails.name}</Text>
                                <Text style={styles.modalSubtitle}>{friendDetails.email}</Text>
                            </View>
                            <TouchableOpacity style={styles.closeBtn} onPress={() => setModalVisible(false)}>
                                <Icon name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalStats}>
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{friendDetails.statistics?.unique_neighborhoods || 0}</Text>
                                <Text style={styles.statLabel}>Turfs</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{Math.round((friendDetails.statistics?.total_distance || 0)/1000)}k</Text>
                                <Text style={styles.statLabel}>km</Text>
                            </View>
                             <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{(friendDetails.statistics?.total_steps || 0).toLocaleString()}</Text>
                                <Text style={styles.statLabel}>Steps</Text>
                            </View>
                        </View>

                        <Text style={styles.modalSectionTitle}>Owned Neighborhoods</Text>
                        <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
                            {friendDetails.owned_neighborhoods && friendDetails.owned_neighborhoods.length > 0 ? (
                                friendDetails.owned_neighborhoods.map(n => (
                                    <View key={n.id} style={styles.turfRow}>
                                        <View>
                                            <Text style={styles.turfName}>{n.name}</Text>
                                            <Text style={styles.turfDate}>Since {new Date(n.captured_at).toLocaleDateString()}</Text>
                                        </View>
                                        <Text style={styles.turfScore}>{n.max_steps} steps</Text>
                                    </View>
                                ))
                            ) : (
                                <Text style={styles.emptyTextSmall}>No turfs owned currently.</Text>
                            )}
                        </ScrollView>
                    </>
                )}
            </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { padding: 18, paddingBottom: 10 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff' },
  scrollContent: { padding: 16 },
  
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)'
  },
  searchInput: { flex: 1, color: '#fff', padding: 12, paddingLeft: 8, fontSize: 16 },
  addButton: { padding: 10, margin: 4, backgroundColor: Colors.accent, borderRadius: 8 },

  section: { marginBottom: 24 },
  sectionTitle: { color: Colors.muted, fontSize: 14, fontWeight: '700', textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 },
  
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)'
  },
  actionButtons: { flexDirection: 'row', gap: 8 },
  iconBtn: { padding: 8, borderRadius: 8 },

  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
  },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  userName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  userEmail: { color: Colors.muted, fontSize: 12 },
  moreBtn: { padding: 8 },

  emptyState: { alignItems: 'center', marginTop: 20 },
  emptyText: { color: Colors.muted, marginTop: 10 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#1e293b', borderRadius: 24, padding: 24 },
  modalHeader: { alignItems: 'center', marginBottom: 20, position: 'relative' },
  closeBtn: { position: 'absolute', right: -10, top: -10, padding: 10 },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  modalSubtitle: { color: Colors.muted, fontSize: 14 },
  
  modalStats: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, marginBottom: 20 },
  statItem: { alignItems: 'center' },
  statValue: { color: Colors.accent, fontSize: 18, fontWeight: 'bold' },
  statLabel: { color: Colors.muted, fontSize: 12 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)' },

  modalSectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  turfRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  turfName: { color: '#fff', fontWeight: '600' },
  turfDate: { color: Colors.muted, fontSize: 12 },
  turfScore: { color: Colors.accent, fontWeight: '700' },
  emptyTextSmall: { color: Colors.muted, fontStyle: 'italic', marginTop: 4 }
});

export default FriendsScreen;