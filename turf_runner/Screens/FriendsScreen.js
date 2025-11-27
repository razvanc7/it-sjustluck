import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

const getAuthHeaders = async () => {
    const token = await AsyncStorage.getItem('userToken');
    return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : null;
};

const FriendsScreen = () => {
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [newFriendName, setNewFriendName] = useState('');
  const [adding, setAdding] = useState(false);

  
  const fetchFriends = useCallback(async () => {
    setLoadingFriends(true);
    const headers = await getAuthHeaders();
    if (!headers) return setLoadingFriends(false);

    try {
      const response = await fetch('http://10.0.2.2:3000/friends', { method: 'GET', headers });
      const data = await response.json();

      if (response.ok) {
        setFriends(data);
      } else {
        Alert.alert('Error', data.error || 'Could not fetch friends list.');
      }
    } catch (error) {
      console.error("Error fetching friends:", error);
    } finally {
      setLoadingFriends(false);
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    setLoadingRequests(true);
    const headers = await getAuthHeaders();
    if (!headers) return setLoadingRequests(false);

    try {
      const response = await fetch('http://10.0.2.2:3000/friends/requests', { method: 'GET', headers });
      const data = await response.json();

      if (response.ok) {
        setRequests(data);
      } else {
        Alert.alert('Requests Error', data.error || 'Could not fetch requests.');
      }
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchFriends();
      fetchRequests();
    }, [fetchFriends, fetchRequests])
  ); 


  const handleAddFriend = async () => {
    if (!newFriendName.trim()) {
      return Alert.alert('Error', 'Please enter friend\'s name.');
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
        fetchRequests(); 
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
      "Delete Friend",
      `Are you sure you want to remove ${friendName} from your friends?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            const headers = await getAuthHeaders();
            if (!headers) return;
            
            try {
              const response = await fetch(`http://10.0.2.2:3000/friends/${friendId}`, {
                method: 'DELETE',
                headers,
              });

              const data = await response.json();
              
              if (response.ok) {
                Alert.alert('Success', data.message || 'Friend deleted successfully.');
                fetchFriends(); 
              } else {
                Alert.alert('Error', data.error || 'Deletion failed.');
              }
            } catch (error) {
              Alert.alert('Network Error', 'Could not delete friend.');
              console.error("Error deleting friend:", error);
            }
          } 
        }
      ]
    );
  };
  
  const handleAcceptRequest = async (senderId, senderName) => {
    const headers = await getAuthHeaders();
    if (!headers) return;

    try {
      const response = await fetch('http://10.0.2.2:3000/friends/accept', {
        method: 'POST',
        headers,
        body: JSON.stringify({ sender_id: senderId }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Success', `You accepted ${senderName}'s request.`);
        fetchRequests();
        fetchFriends();
      } else {
        Alert.alert('Error', data.error || 'Acceptance failed.');
      }
    } catch (error) {
      Alert.alert('Network Error', 'Error accepting request.');
    }
  };
  
  const handleRejectRequest = async (senderId, senderName) => {
    const headers = await getAuthHeaders();
    if (!headers) return;
    
    try {
      const response = await fetch('http://10.0.2.2:3000/friends/reject', {
        method: 'POST',
        headers,
        body: JSON.stringify({ target_id: senderId }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Success', `You rejected ${senderName}'s request.`);
        fetchRequests(); 
      } else {
        Alert.alert('Error', data.error || 'Rejection failed.');
      }
    } catch (error) {
      Alert.alert('Network Error', 'Error rejecting request.');
    }
  };


  const renderFriendItem = ({ item }) => (
    <View style={styles.friendCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.friendName}>{item.name}</Text>
        <Text style={styles.friendEmail}>{item.email}</Text>
      </View>
      <TouchableOpacity 
        style={styles.deleteButton} 
        onPress={() => handleDeleteFriend(item.id, item.name)}
      >
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );
  
  const renderRequestItem = ({ item }) => (
    <View style={styles.requestCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.friendName}>{item.sender_name}</Text>
        <Text style={styles.friendEmail}>{item.sender_email}</Text>
      </View>
      <TouchableOpacity 
        style={styles.acceptButton} 
        onPress={() => handleAcceptRequest(item.sender_id, item.sender_name)}
      >
        <Text style={styles.buttonText}>Accept</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.rejectButton} 
        onPress={() => handleRejectRequest(item.sender_id, item.sender_name)}
      >
        <Text style={styles.deleteButtonText}>Reject</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>My Friends</Text>

      {/* Add Friend Section */}
      <View style={styles.addContainer}>
        <TextInput
          style={styles.input}
          placeholder="Friend's Name" 
          placeholderTextColor="#999"
          value={newFriendName}
          onChangeText={setNewFriendName}
          autoCapitalize="words"
        />
        <TouchableOpacity 
          style={styles.addButton} 
          onPress={handleAddFriend}
          disabled={adding}
        >
          <Text style={styles.buttonText}>{adding ? 'Sending...' : 'Send Request'}</Text>
        </TouchableOpacity>
      </View>
      
      {/* Received Requests Section */}
      <Text style={styles.subtitle}>Received Requests ({requests.length})</Text>
      <View style={styles.listSection}>
        {loadingRequests ? (
          <ActivityIndicator size="small" color="#f39c12" />
        ) : requests.length === 0 ? (
          <Text style={styles.emptyTextSmall}>You have no new requests.</Text>
        ) : (
          <FlatList
            data={requests}
            keyExtractor={(item) => item.sender_id.toString()}
            renderItem={renderRequestItem}
            scrollEnabled={false} 
          />
        )}
      </View>

      {/* Accepted Friends Section */}
      <Text style={styles.subtitle}>Your Friends ({friends.length})</Text>
      <View style={styles.listSection}>
        {loadingFriends ? (
          <ActivityIndicator size="small" color="#3498db" />
        ) : friends.length === 0 ? (
          <Text style={styles.emptyTextSmall}>You have no accepted friends.</Text>
        ) : (
          <FlatList
            data={friends}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderFriendItem}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#1a1a2e',
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  subtitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 15,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
    paddingBottom: 5,
  },
  addContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#0f3460',
    color: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    fontSize: 16,
  },
  addButton: {
    backgroundColor: '#2ecc71',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  listSection: {
    minHeight: 50,
    marginBottom: 10,
  },
  friendCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f3460',
    padding: 15,
    borderRadius: 10,
    marginBottom: 8,
  },
  requestCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2c3e50',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  friendName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  friendEmail: {
    color: '#999',
    fontSize: 12,
    marginTop: 2,
  },
  acceptButton: {
    backgroundColor: '#27ae60',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginLeft: 8,
  },
  rejectButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginLeft: 5,
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyTextSmall: {
    color: '#999',
    textAlign: 'center',
    marginTop: 10,
    fontSize: 14,
  },
});

export default FriendsScreen;