import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, StatusBar, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import Theme, { Colors } from '../components/Theme';

const API_BASE = 'http://10.0.2.2:3000';

const AchievementsScreen = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const resAll = await fetch(`${API_BASE}/achievements`);
      if (!resAll.ok) {
        let errMsg = `Status ${resAll.status}`;
        try {
            const errData = await resAll.json();
            if (errData.error) errMsg = errData.error;
        } catch (e) {}
        throw new Error(errMsg);
      }
      
      const allData = await resAll.json();
      if (!Array.isArray(allData)) throw new Error("Invalid data");

      let mineData = [];
      let profileData = {};
      
      if (token) {
        const [resMine, resProfile] = await Promise.all([
             fetch(`${API_BASE}/achievements/me`, { headers }),
             fetch(`${API_BASE}/profile`, { headers })
        ]);
        if (resMine.ok) mineData = await resMine.json();
        if (resProfile.ok) profileData = await resProfile.json();
      }

      const s = profileData.statistics || {};

      const merged = allData.map(a => {
        const owned = mineData.find(m => m.code === a.code);
        let progress = owned ? 1 : 0;
        let total = 1;

        switch (a.code) {
          case 'first_capture':
            total = 1;
            progress = s.unique_neighborhoods > 0 ? 1 : 0;
            break;
          case 'capture_big': 
             total = 1;
             progress = owned ? 1 : 0; 
             break;
          case 'session_marathon': 
             total = 1;
             progress = owned ? 1 : 0;
             break;
          case 'distance_marathon': // 42km cumulative
             total = 42000;
             progress = s.total_distance || 0;
             break;
          case 'turf_collector_5': // 5 unique turfs
             total = 5;
             progress = s.unique_neighborhoods || 0;
             break;
          default:
             progress = owned ? 1 : 0;
        }

        const percent = Math.min(100, Math.round((progress / total) * 100));
        
        // FIX: Consider unlocked if owned OR if progress is 100%
        const isCompleted = owned || percent >= 100;

        return {
          ...a,
          locked: !isCompleted,
          awarded_at: owned ? owned.awarded_at : (isCompleted ? new Date().toISOString() : null), // Fallback date if completed but not saved
          progress,
          total,
          percent
        };
      }).sort((a, b) => {
        if (a.locked === b.locked) return b.percent - a.percent;
        return a.locked ? 1 : -1;
      });

      setItems(merged);

    } catch (err) {
      console.error('Error loading achievements:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const ProgressBar = ({ percent, locked }) => (
    <View style={styles.progressWrapper}>
        <View style={styles.track}>
            <View style={[styles.fill, { width: `${percent}%`, backgroundColor: locked ? '#475569' : Colors.accent }]} />
        </View>
        <Text style={styles.progressLabel}>{percent}%</Text>
    </View>
  );

  const renderItem = ({ item }) => (
    <View style={[styles.card, item.locked ? styles.cardLocked : styles.cardUnlocked]}>
      <View style={[styles.iconContainer, item.locked ? styles.iconLocked : styles.iconUnlocked]}>
        <Text style={styles.icon}>{item.icon || '🏅'}</Text>
      </View>
      
      <View style={styles.content}>
        <View style={styles.header}>
            <Text style={[styles.title, item.locked && styles.textLocked]}>{item.title}</Text>
            {!item.locked && (
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>COMPLETED</Text>
                </View>
            )}
        </View>
        
        <Text style={[styles.description, !item.locked && styles.descUnlocked]}>{item.description}</Text>
        
        <View style={styles.footer}>
            <ProgressBar percent={item.percent} locked={item.locked} />
            {!item.locked && item.awarded_at && (
                <Text style={[styles.date, styles.dateUnlocked]}>Unlocked on {new Date(item.awarded_at).toLocaleDateString()}</Text>
            )}
            {item.locked && item.total > 1 && (
                <Text style={styles.date}>{Math.round(item.progress)} / {item.total} completed</Text>
            )}
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <View style={styles.screenHeader}>
         <Text style={styles.screenTitle}>My Trophies</Text>
         <Text style={styles.screenSubtitle}>Track your turf domination progress</Text>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Polishing trophies...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={fetchData} style={styles.retryBtn}>
                <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.code}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.centerBox}>
                <Text style={styles.emptyText}>No achievements found yet.</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  list: { padding: 16, paddingBottom: 40 },
  
  screenHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  screenTitle: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  screenSubtitle: { fontSize: 14, color: '#94a3b8', marginTop: 4 },

  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 400 },
  loadingText: { color: '#94a3b8', marginTop: 12 },
  errorText: { color: Colors.danger, textAlign: 'center', paddingHorizontal: 20, marginBottom: 15 },
  emptyText: { color: '#64748b', fontSize: 16 },
  
  retryBtn: { backgroundColor: Colors.accent, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 8 },
  retryText: { color: '#0f172a', fontWeight: 'bold' },

  card: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  cardUnlocked: {
    backgroundColor: '#162e4a', // Slightly brighter blue
    borderWidth: 2, // Thicker border
    borderColor: Colors.accent, // Bright accent color
    shadowColor: Colors.accent, // Colored shadow
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
    transform: [{ scale: 1.02 }] // Slightly larger
  },
  cardLocked: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    opacity: 0.8
  },

  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  iconUnlocked: {
    backgroundColor: 'rgba(6, 182, 212, 0.2)', // Accent background
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.5)'
  },
  iconLocked: {
    backgroundColor: '#1e293b',
    opacity: 0.5
  },
  icon: { fontSize: 28 },

  content: { flex: 1, justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  title: { fontSize: 17, fontWeight: '800', color: '#fff' }, // Bolder
  textLocked: { color: '#94a3b8', fontWeight: '600' },
  
  badge: { backgroundColor: Colors.accent, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: '#04263a', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

  description: { fontSize: 13, color: '#cbd5e1', lineHeight: 18, marginBottom: 14 },
  descUnlocked: { color: '#e2e8f0', fontWeight: '500' },

  footer: { marginTop: 4 },
  progressWrapper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  track: { flex: 1, height: 8, backgroundColor: '#0f172a', borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  progressLabel: { color: '#fff', fontSize: 12, fontWeight: '700', minWidth: 35, textAlign: 'right' },
  
  date: { marginTop: 6, fontSize: 11, color: '#64748b', fontStyle: 'italic', textAlign: 'right' },
  dateUnlocked: { color: Colors.accent, opacity: 0.9 }
});

export default AchievementsScreen;
