import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Theme from './Theme';
import { navigate } from '../RootNavigation';

const POLL_INTERVAL_MS = 4000; // Faster polling
const API_BASE = 'http://10.0.2.2:3000';

const NotificationsBanner = () => {
  const [notif, setNotif] = useState(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;
      
      // If we are already showing a notification, don't fetch/overwrite it
      // unless you want to maintain a queue. For simplicity, wait until dismissed.
      // But to rely on state 'notif', we need to be careful inside setInterval closure.
      // However, usually it's fine to fetch and see if we need to update.
      // If we check 'notif' here it might be stale. 
      // Instead, we can just fetch and if we have 'notif' skip animation or queuing.
      // Let's keep it simple: Fetch. If data exists, show it.
      
      const res = await fetch(`${API_BASE}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      
      const rows = await res.json();
      if (!Array.isArray(rows)) return; // Safety check

      const unread = rows.find(r => !r.is_read);
      
      // Only update if we don't have one, or if it's different?
      // For now, if we have no current notification, show this one.
      setNotif(current => {
          if (!current && unread) {
              Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
              return unread;
          }
          return current;
      });

    } catch (err) {
      // silent
    }
  };

  useEffect(() => {
    fetchNotifications();
    timerRef.current = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const markRead = async (id) => {
    // Animate out
    Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(async () => {
        setNotif(null);
        // API Call
        try {
            const token = await AsyncStorage.getItem('userToken');
            if (token) {
                await fetch(`${API_BASE}/notifications/mark-read`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ id })
                });
                // Immediately fetch next
                fetchNotifications();
            }
        } catch (err) { }
    });
  };

  if (!notif) return null;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: anim.interpolate({ inputRange: [0,1], outputRange: [-100, 0] }) }] }] }>
      <TouchableOpacity activeOpacity={0.9} onPress={() => { navigate('Notifications'); markRead(notif.id); }}>
        <View style={styles.inner}>
          <Text numberOfLines={2} style={styles.message}>{notif.message}</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.btn} onPress={(e) => { e.stopPropagation(); markRead(notif.id); }}>
              <Text style={styles.btnText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    paddingHorizontal: 12,
    paddingTop: 12
  },
  inner: {
    backgroundColor: Theme.Colors.accent,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6
  },
  message: {
    color: '#042a2b',
    flex: 1,
    fontWeight: '600'
  },
  actions: {
    marginLeft: 12,
    flexDirection: 'row'
  },
  btn: {
    backgroundColor: '#ffffff55',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6
  },
  btnText: {
    color: '#fff',
    fontWeight: '700'
  }
});

export default NotificationsBanner;
