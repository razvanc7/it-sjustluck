import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { neighborhoods } from '../data/neighborhoods';

const LeaderboardScreen = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      // Use 10.0.2.2 for Android emulator to access local backend
      const response = await fetch('http://10.0.2.2:3000/leaderboard'); 
      const json = await response.json();
      setData(json);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getNeighborhoodName = (id) => {
    const hood = neighborhoods.find(n => n.id === id);
    return hood ? hood.name : id;
  };

  const renderItem = ({ item }) => (
    <View style={styles.item}>
      <View style={styles.header}>
        <Text style={styles.neighborhood}>{getNeighborhoodName(item.neighborhood_id)}</Text>
        <Text style={styles.steps}>{item.max_steps} steps</Text>
      </View>
      <Text style={styles.owner}>Held by: <Text style={styles.ownerName}>{item.owner_name}</Text></Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Turf Control</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#3498db" />
      ) : (
        <FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={(item) => item.neighborhood_id + item.captured_at}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No turfs captured yet!</Text>}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#fff' },
  list: { paddingBottom: 20 },
  item: { 
    padding: 15, 
    marginBottom: 10,
    backgroundColor: '#0f3460', 
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db'
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  neighborhood: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  steps: { fontSize: 14, color: '#a0a0a0' },
  owner: { fontSize: 16, color: '#ccc' },
  ownerName: { color: '#4cc9f0', fontWeight: 'bold' },
  emptyText: { color: '#aaa', textAlign: 'center', marginTop: 20, fontSize: 16 }
});

export default LeaderboardScreen;