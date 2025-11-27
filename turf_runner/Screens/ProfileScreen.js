import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

const ProfileScreen = ({ navigation }) => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('userId');
    Alert.alert('Logged Out', 'You have been successfully logged out.');
    navigation.replace('Login'); 
  };

  const fetchProfile = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      }

      const token = await AsyncStorage.getItem('userToken');

      if (!token) {
        Alert.alert('Error', 'You are not authenticated.');
        navigation.replace('Login');
        return;
      }

      const response = await fetch('http://10.0.2.2:3000/profile', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setUserData(data);
      } else {
        Alert.alert('Error', data.error || 'Could not fetch profile data.');
        if (response.status === 403 || response.status === 401) {
           handleLogout();
        }
      }
    } catch (error) {
      Alert.alert('Network Error', 'Could not connect to the server.');
      console.error("Error fetching profile:", error);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
      setRefreshing(false);
    }
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProfile(false);
  }, [fetchProfile]);

  const formatDistance = (meters) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} KM`;
    }
    return `${meters.toFixed(0)} M`;
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#0452b7" />
        <Text style={{ color: '#ffffff', marginTop: 10 }}>Loading profile...</Text>
      </View>
    );
  }

  if (!userData) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Loading Error</Text>
        <TouchableOpacity style={styles.button} onPress={handleLogout}>
            <Text style={styles.buttonText}>Logout</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#0452b7"
            colors={["#0452b7"]}
          />
        }
      >
        <Text style={styles.title}>My Profile</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Name:</Text>
          <Text style={styles.value}>{userData.name}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Email:</Text>
          <Text style={styles.value}>{userData.email}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Member Since:</Text>
          <Text style={styles.value}>{new Date(userData.created_at).toLocaleDateString()}</Text>
        </View>
        
        <Text style={styles.statsHeader}>Turfing Statistics</Text>
        
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {formatDistance(userData.statistics?.total_distance || 0)}
            </Text>
            <Text style={styles.statLabel}>Total Distance</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {(userData.statistics?.total_steps || 0).toLocaleString()}
            </Text>
            <Text style={styles.statLabel}>Total Steps</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {userData.statistics?.total_sessions || 0}
            </Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {userData.statistics?.unique_neighborhoods || 0}
            </Text>
            <Text style={styles.statLabel}>Neighborhoods</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.buttonText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
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
    marginBottom: 30,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#0f3460',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  label: {
    color: '#999',
    fontSize: 14,
    marginBottom: 5,
  },
  value: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  statsHeader: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 15,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#0f3460',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#16213e',
  },
  statValue: {
    color: '#00d9ff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  statLabel: {
    color: '#999',
    fontSize: 12,
    textAlign: 'center',
  },
  logoutButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 20,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProfileScreen;