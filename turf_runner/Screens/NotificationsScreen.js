import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Theme from '../components/Theme';

const API_BASE = 'http://10.0.2.2:3000';

const NotificationsScreen = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        setError('Not authenticated. Please login.');
        setLoading(false);
        return;
      }
      
      console.log('Fetching notifications...');
      const res = await fetch(`${API_BASE}/notifications`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      
      console.log('Response status:', res.status);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Error response:', errorText);
        setError(`Error ${res.status}: ${errorText}`);
        setLoading(false);
        return;
      }
      
      const data = await res.json();
      console.log('Notifications fetched:', data.length);
      setItems(data);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchNotifications(); 
  }, []);

  const markRead = async (id) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;
      
      await fetch(`${API_BASE}/notifications/mark-read`, {
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${token}` 
        }, 
        body: JSON.stringify({ id })
      });
      
      fetchNotifications();
    } catch (err) {
      console.error('Mark read error:', err);
    }
  };

  const markAllRead = async () => {
    const unreadIds = items.filter(i => !i.is_read).map(i => i.id);
    if (unreadIds.length === 0) {
      Alert.alert('Info', 'No unread notifications');
      return;
    }
    
    for (const id of unreadIds) {
      await markRead(id);
    }
  };

  const renderItem = ({ item }) => (
    <View style={[styles.row, item.is_read ? styles.read : null]}>
      <View style={styles.content}>
        <Text style={styles.message}>{item.message}</Text>
        <Text style={styles.date}>{new Date(item.created_at).toLocaleString()}</Text>
      </View>
      {!item.is_read && (
        <TouchableOpacity style={styles.actionBtn} onPress={() => markRead(item.id)}>
          <Text style={styles.actionText}>Mark read</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchNotifications} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {items.length > 0 && (
        <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
          <Text style={styles.markAllText}>Mark All Read</Text>
        </TouchableOpacity>
      )}
      
      <FlatList 
        data={items} 
        keyExtractor={i => String(i.id)} 
        renderItem={renderItem} 
        refreshControl={
          <RefreshControl 
            refreshing={loading} 
            onRefresh={fetchNotifications}
            tintColor="#fff"
          />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {loading ? 'Loading...' : 'No notifications'}
          </Text>
        } 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: Theme.Colors.background, 
    padding: 12 
  },
  row: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 12, 
    backgroundColor: Theme.Colors.card, 
    borderRadius: 8, 
    marginBottom: 10 
  },
  read: { 
    opacity: 0.6 
  },
  content: { 
    flex: 1 
  },
  message: { 
    color: '#fff', 
    fontWeight: '600' 
  },
  date: { 
    color: Theme.Colors.muted, 
    marginTop: 6, 
    fontSize: 12 
  },
  actionBtn: { 
    marginLeft: 12, 
    backgroundColor: Theme.Colors.accent2, 
    paddingVertical: 6, 
    paddingHorizontal: 8, 
    borderRadius: 6 
  },
  actionText: { 
    color: '#042a2b', 
    fontWeight: '700' 
  },
  empty: { 
    color: Theme.Colors.muted, 
    marginTop: 40, 
    textAlign: 'center' 
  },
  errorBox: {
    backgroundColor: '#dc2626',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  errorText: {
    color: '#fff',
    flex: 1,
    fontWeight: '600'
  },
  retryBtn: {
    backgroundColor: '#fff',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginLeft: 8
  },
  retryText: {
    color: '#dc2626',
    fontWeight: '700'
  },
  markAllBtn: {
    backgroundColor: Theme.Colors.accent,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center'
  },
  markAllText: {
    color: '#042a2b',
    fontWeight: '700'
  }
});

export default NotificationsScreen;
