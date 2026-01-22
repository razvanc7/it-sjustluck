import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, ScrollView, RefreshControl, StatusBar, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import Theme, { Colors, Avatar } from '../components/Theme';

const ProfileScreen = ({ navigation }) => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Edit State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editColor, setEditColor] = useState('');
  const [saving, setSaving] = useState(false);

  // Predefined color palette
  const AVATAR_COLORS = [
    '#0000FF', '#ef4444', '#10b981', '#f59e0b', 
    '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1',
    '#14b8a6', '#f43f5e', '#d946ef', '#3b82f6'
  ];

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
      if (!token) return navigation.replace('Login');

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
        // Pre-fill edit form
        setEditName(data.name);
        setEditEmail(data.email);
        setEditColor(data.color || '#0000FF');
      } else {
        if (response.status === 403 || response.status === 401) handleLogout();
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      if (showLoader) setLoading(false);
      setRefreshing(false);
    }
  }, [navigation]);

  const handleSaveProfile = async () => {
    if (!editName.trim() || !editEmail.trim()) {
      return Alert.alert('Validation Error', 'Name and Email are required.');
    }
    
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch('http://10.0.2.2:3000/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editName,
          email: editEmail,
          color: editColor
        })
      });

      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', 'Profile updated!');
        setUserData(prev => ({ ...prev, ...data.user }));
        setEditModalVisible(false);
      } else {
        Alert.alert('Update Failed', data.error || 'Could not update profile.');
      }
    } catch (err) {
      Alert.alert('Error', 'Connection failed.');
    } finally {
      setSaving(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProfile(false);
  }, [fetchProfile]);

  const MenuItem = ({ icon, title, onPress, isDestructive }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.menuIconBox, { backgroundColor: isDestructive ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.05)' }]}>
        <Icon name={icon} size={20} color={isDestructive ? Colors.danger : '#fff'} />
      </View>
      <Text style={[styles.menuText, isDestructive && { color: Colors.danger }]}>{title}</Text>
      <Icon name="chevron-forward" size={18} color={Colors.muted} />
    </TouchableOpacity>
  );

  const StatCard = ({ icon, label, value, color }) => (
    <View style={styles.statCard}>
      <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
        <Icon name={icon} size={22} color={color} />
      </View>
      <View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} colors={[Colors.accent]} />}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setEditModalVisible(true)} style={styles.avatarContainer}>
             <Avatar name={userData.name} size={100} color={userData.color} />
             <View style={styles.editIconBadge}>
               <Icon name="pencil" size={14} color="#fff" />
             </View>
          </TouchableOpacity>
          <Text style={styles.name}>{userData.name}</Text>
          <Text style={styles.email}>{userData.email}</Text>
          <View style={styles.badge}>
             <Text style={styles.badgeText}>Turf Runner</Text>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statistics</Text>
          <View style={styles.statsGrid}>
            <StatCard icon="walk-outline" label="Distance" value={`${((userData.statistics?.total_distance || 0)/1000).toFixed(2)} km`} color={Colors.accent} />
            <StatCard icon="footsteps-outline" label="Steps" value={(userData.statistics?.total_steps || 0).toLocaleString()} color="#10b981" />
            <StatCard icon="map-outline" label="Turfs" value={userData.statistics?.unique_neighborhoods || 0} color="#f59e0b" />
            <StatCard icon="time-outline" label="Sessions" value={userData.statistics?.total_sessions || 0} color="#8b5cf6" />
          </View>
        </View>

        {/* Menu Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.menuContainer}>
            <MenuItem icon="trophy-outline" title="Achievements" onPress={() => navigation.navigate('Achievements')} />
            <MenuItem icon="settings-outline" title="Edit Profile" onPress={() => setEditModalVisible(true)} />
          </View>
          <View style={[styles.menuContainer, { marginTop: 20 }]}>
            <MenuItem icon="log-out-outline" title="Logout" onPress={handleLogout} isDestructive />
          </View>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent={true} onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Edit Profile</Text>
                
                <Text style={styles.inputLabel}>Display Name</Text>
                <TextInput style={styles.input} value={editName} onChangeText={setEditName} placeholder="Username" placeholderTextColor={Colors.muted} />
                
                <Text style={styles.inputLabel}>Email Address</Text>
                <TextInput style={styles.input} value={editEmail} onChangeText={setEditEmail} placeholder="Email" keyboardType="email-address" placeholderTextColor={Colors.muted} />
                
                <Text style={styles.inputLabel}>Avatar Color</Text>
                <View style={styles.colorGrid}>
                  {AVATAR_COLORS.map((color) => (
                    <TouchableOpacity 
                      key={color} 
                      style={[
                        styles.colorOption, 
                        { backgroundColor: color },
                        editColor === color && styles.colorSelected
                      ]} 
                      onPress={() => setEditColor(color)}
                    />
                  ))}
                </View>

                <View style={styles.modalButtons}>
                    <TouchableOpacity style={styles.cancelButton} onPress={() => setEditModalVisible(false)}>
                        <Text style={styles.buttonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile} disabled={saving}>
                        {saving ? <ActivityIndicator color="#04263a" size="small" /> : <Text style={[styles.buttonText, { color: '#04263a' }]}>Save Changes</Text>}
                    </TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 40 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', paddingVertical: 30, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  avatarContainer: { padding: 4, backgroundColor: Colors.card, borderRadius: 55, marginBottom: 16, position: 'relative' },
  editIconBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: Colors.accent, borderRadius: 12, padding: 6, borderWidth: 2, borderColor: Colors.background },
  name: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  email: { fontSize: 14, color: Colors.muted, marginBottom: 12 },
  badge: { paddingHorizontal: 12, paddingVertical: 4, backgroundColor: 'rgba(6, 182, 212, 0.15)', borderRadius: 12 },
  badgeText: { fontSize: 12, color: Colors.accent, fontWeight: '600' },
  section: { padding: 20, paddingBottom: 0 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 16, marginLeft: 4 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: Colors.card, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconContainer: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  statLabel: { fontSize: 12, color: Colors.muted },
  menuContainer: { backgroundColor: Colors.card, borderRadius: 16, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  menuIconBox: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  menuText: { flex: 1, fontSize: 16, color: '#fff', fontWeight: '500' },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#1e293b', borderRadius: 24, padding: 24 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 20, textAlign: 'center' },
  inputLabel: { color: Colors.muted, fontSize: 12, marginBottom: 6, fontWeight: '600' },
  input: { backgroundColor: Colors.card, color: '#fff', padding: 12, borderRadius: 10, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  
  // New Styles for Color Palette
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  colorOption: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
  colorSelected: { borderColor: '#fff' },

  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 10 },
  cancelButton: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: Colors.card, alignItems: 'center' },
  saveButton: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: Colors.accent, alignItems: 'center' },
  buttonText: { fontWeight: '700', color: '#fff', fontSize: 15 }
});

export default ProfileScreen;