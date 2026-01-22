import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { neighborhoods } from '../data/neighborhoods';
import Theme, { Colors, Avatar } from '../components/Theme';

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
        <ActivityIndicator size="large" color={Colors.accent} />
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
  container: { flex: 1, backgroundColor: Colors.background, padding: 18 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 14, textAlign: 'center', color: '#fff' },
  list: { paddingBottom: 20 },
  item: { 
    padding: 14, 
    marginBottom: 12,
    backgroundColor: Colors.card, 
    borderRadius: 12,
    borderLeftWidth: 6,
    borderLeftColor: Colors.accent,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 3
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  neighborhood: { fontSize: 16, fontWeight: '800', color: '#fff' },
  steps: { fontSize: 13, color: Colors.muted },
  owner: { fontSize: 14, color: Colors.muted },
  ownerName: { color: Colors.accent, fontWeight: '800' },
  emptyText: { color: Colors.muted, textAlign: 'center', marginTop: 20, fontSize: 15 }
});

export default LeaderboardScreen;