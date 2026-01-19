import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, View, Text, FlatList, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, ActivityIndicator, ImageBackground 
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { isPointInPolygon } from 'geolib';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Added import
import { neighborhoods } from '../data/neighborhoods';

const ChatScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets(); // Hook for insets
  const [currentNeighborhood, setCurrentNeighborhood] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const flatListRef = useRef();

  useEffect(() => {
    AsyncStorage.getItem('userId').then(id => setUserId(parseInt(id)));
    
    // Initial checks
    checkLocationAndFetch();

    // Poll for messages and location location every 3 seconds
    const interval = setInterval(checkLocationAndFetch, 3000);
    return () => clearInterval(interval);
  }, []);

  const checkLocationAndFetch = () => {
    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const found = neighborhoods.find(n => 
          isPointInPolygon({ latitude, longitude }, n.coordinates)
        );
        
        // Update neighborhood context
        if (found && found.id !== currentNeighborhood?.id) {
            setCurrentNeighborhood(found);
            fetchMessages(found.id); // Immediate fetch on switch
        } else if (!found) {
            setCurrentNeighborhood(null);
        } else if (found) {
            // Same neighborhood, just refresh messages
            fetchMessages(found.id);
        }
        setLoading(false);
      },
      (error) => {
        console.log(error);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  const fetchMessages = async (hoodId) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      // Use 10.0.2.2 for Android Emulator, localhost for iOS
      const res = await fetch(`http://10.0.2.2:3000/chat/${hoodId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setMessages(data);
    } catch (err) {
      console.error(err);
    }
  };

  const sendMessage = async () => {
    if (inputText.trim().length === 0 || !currentNeighborhood) return;

    const messageToSend = inputText;
    setInputText(""); // Optimistic clear

    try {
      const token = await AsyncStorage.getItem('userToken');
      await fetch(`http://10.0.2.2:3000/chat/${currentNeighborhood.id}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: messageToSend })
      });
      fetchMessages(currentNeighborhood.id); // Refresh immediately
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <View style={[styles.center, {backgroundColor: '#1a1a2e'}]}><ActivityIndicator size="large" color="#3498db"/></View>;

  if (!currentNeighborhood) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Icon name="location-outline" size={80} color="#455" />
        <Text style={styles.emptyTitle}>You're not in a Turf!</Text>
        <Text style={styles.emptyText}>Run to a neighborhood to join its chat room.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}> 
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{currentNeighborhood.name}</Text>
        <View style={styles.onlineBadge}>
          <View style={styles.greenDot} />
          <Text style={styles.onlineText}>Live</Text>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        renderItem={({ item }) => {
          const isMe = item.user_id === userId;
          return (
            <View style={[styles.row, isMe ? styles.rowEnd : styles.rowStart]}>
                {!isMe && (
                   <View style={[styles.avatar, { backgroundColor: item.user_color || '#777' }]}>
                        <Text style={styles.avatarText}>{item.user_name?.charAt(0).toUpperCase()}</Text>
                   </View>
                )}
                <View style={[
                    styles.msgContainer, 
                    isMe ? styles.myMsg : styles.theirMsg
                ]}>
                    {!isMe && (
                        <Text style={[styles.userName, { color: item.user_color || '#f1c40f' }]}
                        >
                            {item.user_name}
                        </Text>
                    )}
                    <Text style={styles.msgText}>{item.message}</Text>
                </View>
            </View>
          );
        }}
      />

      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        style={styles.inputWrapper}
      >
        <View style={styles.inputContainer}>
            <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Say something..."
            placeholderTextColor="#888"
            returnKeyType="send"
            onSubmitEditing={sendMessage}
            />
            <TouchableOpacity onPress={sendMessage} style={styles.sendButton} activeOpacity={0.8}>
            <Icon name="send" size={20} color="#fff" />
            </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212', padding: 30 },
  emptyTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginTop: 20 },
  emptyText: { color: '#888', fontSize: 16, marginTop: 10, textAlign: 'center' },
  
  header: { 
      paddingVertical: 15, 
      paddingHorizontal: 20, 
      backgroundColor: '#1E1E2E', 
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: '#2A2A3C',
      elevation: 5
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', letterSpacing: 0.5 },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2A2A3C', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4cd137', marginRight: 6 },
  onlineText: { color: '#ccc', fontSize: 12, fontWeight: '600' },

  list: { paddingHorizontal: 15, paddingVertical: 20 },
  row: { flexDirection: 'row', marginBottom: 15, alignItems: 'flex-end' },
  rowStart: { justifyContent: 'flex-start' },
  rowEnd: { justifyContent: 'flex-end' },

  avatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 8, marginBottom: 2 },
  avatarText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

  msgContainer: { 
      maxWidth: '75%', 
      paddingVertical: 10, 
      paddingHorizontal: 14, 
      borderRadius: 18, 
  },
  myMsg: { 
      backgroundColor: '#3498db', 
      borderBottomRightRadius: 4,
  },
  theirMsg: { 
      backgroundColor: '#2A2A3C', 
      borderBottomLeftRadius: 4,
  },
  userName: { fontSize: 12, marginBottom: 4, fontWeight: 'bold', opacity: 0.9 },
  msgText: { color: '#fff', fontSize: 15, lineHeight: 20 },

  inputWrapper: { backgroundColor: '#1E1E2E', padding: 10 },
  inputContainer: { 
      flexDirection: 'row', 
      backgroundColor: '#2A2A3C', 
      borderRadius: 25, 
      alignItems: 'center',
      paddingHorizontal: 5,
      paddingVertical: 5
  },
  input: { flex: 1, color: '#fff', paddingHorizontal: 15, fontSize: 16, height: 40 },
  sendButton: { 
      backgroundColor: '#3498db', 
      width: 40, height: 40, 
      borderRadius: 20, 
      justifyContent: 'center', 
      alignItems: 'center',
      marginLeft: 5 
  },
});

export default ChatScreen;