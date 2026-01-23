import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, View, Text, FlatList, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, ActivityIndicator, ImageBackground 
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { isPointInPolygon } from 'geolib';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { neighborhoods } from '../data/neighborhoods';
import Theme, { Colors, Avatar } from '../components/Theme';

const ChatScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [currentNeighborhood, setCurrentNeighborhood] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const flatListRef = useRef();

  useEffect(() => {
    AsyncStorage.getItem('userId').then(id => setUserId(parseInt(id)));
    
    checkLocationAndFetch();

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
        
        if (found && found.id !== currentNeighborhood?.id) {
            setCurrentNeighborhood(found);
            fetchMessages(found.id);
        } else if (!found) {
            setCurrentNeighborhood(null);
        } else if (found) {
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
      // Use 10.0.2.2 for Android -> Localhost
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

  if (loading) return (
    <View style={[styles.center, {backgroundColor: Colors.background}]}>
      <ActivityIndicator size="large" color={Colors.accent}/>
    </View>
  );

  if (!currentNeighborhood) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}> 
        <View style={styles.emptyIconContainer}>
            <Icon name="location-outline" size={60} color={Colors.muted} />
        </View>
        <Text style={styles.emptyTitle}>You're not in a Turf!</Text>
        <Text style={styles.emptyText}>Run to a neighborhood to join the chat.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}> 
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>Current Turf</Text>
          <Text style={styles.headerTitle}>{currentNeighborhood.name}</Text>
        </View>
        <View style={styles.onlineBadge}>
          <View style={styles.liveIndicator}>
             <View style={styles.liveDot} />
             <View style={[styles.liveDot, styles.liveDotPing]} />
          </View>
          <Text style={styles.onlineText}>LIVE</Text>
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
                   <View style={{ marginRight: 8, marginBottom: 2 }}>
                       <Avatar name={item.user_name} size={32} color={item.user_color} />
                   </View>
                 )}
                <View style={[
                    styles.msgContainer, 
                    isMe ? styles.myMsg : styles.theirMsg
                ]}>
                    {!isMe && (
                        <Text style={[styles.userName, { color: item.user_color || Colors.accent }]}>
                            {item.user_name}
                        </Text>
                    )}
                    <Text style={[styles.msgText, isMe ? styles.myMsgText : styles.theirMsgText]}>
                        {item.message}
                    </Text>
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
        <View style={styles.inputCard}>
            <TextInput
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Message the crew..."
                placeholderTextColor={Colors.muted}
                returnKeyType="send"
                onSubmitEditing={sendMessage}
            />
            <TouchableOpacity 
                onPress={sendMessage} 
                style={[styles.sendButton, { opacity: inputText.trim() ? 1 : 0.5 }]} 
                activeOpacity={0.8}
                disabled={!inputText.trim()}
            >
                <Icon name="arrow-up" size={20} color="#fff" />
            </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center', 
      backgroundColor: Colors.background, 
      padding: 30 
  },
  
  // Empty State
  emptyIconContainer: {
      width: 120, height: 120, borderRadius: 60,
      backgroundColor: Colors.card,
      justifyContent: 'center', alignItems: 'center',
      marginBottom: 20,
      borderWidth: 1, borderColor: '#2A2A3C'
  },
  emptyTitle: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 10 },
  emptyText: { color: Colors.muted, fontSize: 16, textAlign: 'center', lineHeight: 24 },
  
  // Header
  header: { 
      paddingVertical: 16, 
      paddingHorizontal: 24, 
      backgroundColor: Colors.background,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: '#1e293b',
  },
  headerSub: { color: Colors.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  
  onlineBadge: { 
      flexDirection: 'row', alignItems: 'center', 
      backgroundColor: 'rgba(239, 68, 68, 0.15)', 
      paddingHorizontal: 8, paddingVertical: 4, 
      borderRadius: 6, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)'
  },
  liveIndicator: {
      position: 'relative', width: 8, height: 8, marginRight: 6, justifyContent: 'center', alignItems: 'center'
  },
  liveDot: {
      width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444',
  },
  liveDotPing: {
      position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444', opacity: 0.4
  },
  onlineText: { color: '#ef4444', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  // List
  list: { paddingHorizontal: 16, paddingVertical: 20 },
  row: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
  rowStart: { justifyContent: 'flex-start' },
  rowEnd: { justifyContent: 'flex-end' },

  msgContainer: { 
      maxWidth: '80%', 
      paddingVertical: 12, 
      paddingHorizontal: 16, 
      borderRadius: 20, 
  },
  myMsg: { 
      backgroundColor: Colors.accent, 
      borderBottomRightRadius: 2,
  },
  theirMsg: { 
      backgroundColor: Colors.card, 
      borderBottomLeftRadius: 2,
  },
  userName: { fontSize: 11, marginBottom: 4, fontWeight: '700', paddingLeft: 1 },
  msgText: { fontSize: 15, lineHeight: 22 },
  myMsgText: { color: '#fff' },
  theirMsgText: { color: '#e2e8f0' },

  // Input
  inputWrapper: { 
      backgroundColor: Colors.background, 
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: '#1e293b'
  },
  inputCard: { 
      flexDirection: 'row', 
      backgroundColor: Colors.card, 
      borderRadius: 24, 
      alignItems: 'center',
      paddingRight: 6,
      paddingLeft: 6,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: '#1e293b'
  },
  input: { flex: 1, color: '#fff', paddingHorizontal: 15, fontSize: 16, height: 40 },
  sendButton: { 
      backgroundColor: Colors.accent, 
      width: 36, height: 36, 
      borderRadius: 18, 
      justifyContent: 'center', 
      alignItems: 'center',
  },
});

export default ChatScreen;