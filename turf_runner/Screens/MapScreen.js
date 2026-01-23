import React, { useEffect, useState, useRef, useCallback } from 'react';
import { StyleSheet, View, ActivityIndicator, Platform, PermissionsAndroid, Text, TouchableOpacity, Modal } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Polyline, Polygon } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { neighborhoods } from '../data/neighborhoods';
import Icon from 'react-native-vector-icons/FontAwesome5';
import Theme, { Colors, Avatar } from '../components/Theme';

const MapScreen = ({ navigation }) => {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isTracking, setIsTracking] = useState(false);
  const [route, setRoute] = useState([]);
  const [distance, setDistance] = useState(0);
  const [steps, setSteps] = useState(0);
  const [visitedNeighborhoodsCount, setVisitedNeighborhoodsCount] = useState(0);
  const [currentRegion, setCurrentRegion] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  
  const [ownerships, setOwnerships] = useState({});

  const mapRef = useRef(null);

  // Memoize the fetch function
  const fetchMapState = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      const response = await fetch('http://10.0.2.2:3000/location/map-state', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      const newOwnerships = {};
      if (Array.isArray(data)) {
        data.forEach(item => {
          newOwnerships[item.neighborhood_id] = {
            owner_name: item.owner_name,
            owner_color: item.owner_color,
            max_steps: item.max_steps,
            captured_at: item.captured_at
          };
        });
      }
      setOwnerships(newOwnerships);
    } catch (err) {
      console.error("Failed to load map owner colors", err);
    }
  }, []);

  // Poll for updates when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchMapState(); // Fetch immediately on focus

      const intervalId = setInterval(() => {
        fetchMapState();
      }, 5000); // 5 seconds polling

      return () => clearInterval(intervalId); // Cleanup on blur
    }, [fetchMapState])
  );

  const getAuthHeaders = async () => {
    const token = await AsyncStorage.getItem('userToken');
    return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : null;
  };

  const getNeighborhoodColor = (neighborhoodId) => {
    if (ownerships[neighborhoodId]) {
      const c = ownerships[neighborhoodId].owner_color || ownerships[neighborhoodId].color;
      try {
        return (c || '#cccccc') + '80';
      } catch (e) {
        return 'rgba(200, 200, 200, 0.1)';
      }
    }
    return 'rgba(200, 200, 200, 0.1)';
  };

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(null);
  const [neighborhoodDetails, setNeighborhoodDetails] = useState(null);

  const handleNeighborhoodPress = async (neighborhoodId) => {
    let details = null;
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        const resp = await fetch(`http://10.0.2.2:3000/location/neighborhood/${neighborhoodId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resp.ok) {
          details = await resp.json();
        }
      }
    } catch (err) {
      console.error('Error fetching neighborhood details', err);
    }

    // Fallback to locally cached ownerships if backend/details not available
    if (!details && ownerships[neighborhoodId]) {
      const o = ownerships[neighborhoodId];
      details = {
        neighborhood_id: neighborhoodId,
        owner_name: o.owner_name || o.owner,
        owner_color: o.owner_color || o.color,
        max_steps: o.max_steps,
        captured_at: o.captured_at
      };
    }

    setNeighborhoodDetails(details);
    setSelectedNeighborhood(neighborhoodId);
    setModalVisible(true);
  };

  const getNeighborhoodStroke = (neighborhoodId) => {
    if (ownerships[neighborhoodId]) {
      return ownerships[neighborhoodId].owner_color || ownerships[neighborhoodId].color || '#cccccc';
    }
    return '#cccccc';
  };

  const handleZoomIn = () => {
    if (mapRef.current && currentRegion) {
      const newRegion = {
        ...currentRegion,
        latitudeDelta: currentRegion.latitudeDelta / 1.5,
        longitudeDelta: currentRegion.longitudeDelta / 1.5,
      };
      mapRef.current.animateToRegion(newRegion, 300);
      setCurrentRegion(newRegion);
    }
  };

  const handleZoomOut = () => {
    if (mapRef.current && currentRegion) {
      const newRegion = {
        ...currentRegion,
        latitudeDelta: currentRegion.latitudeDelta * 1.5,
        longitudeDelta: currentRegion.longitudeDelta * 1.5,
      };
      mapRef.current.animateToRegion(newRegion, 300);
      setCurrentRegion(newRegion);
    }
  };

  useEffect(() => {
    const requestLocationPermission = async () => {
      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            setLoading(false); return;
          }
        } catch (err) {
          console.warn(err); setLoading(false); return;
        }
      }

      Geolocation.getCurrentPosition(
        (position) => {
          const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
          setLocation(coords);
          setCurrentRegion({
            latitude: coords.latitude,
            longitude: coords.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          });
          setLoading(false);
        },
        (error) => { console.log(error); setLoading(false); },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    };

    requestLocationPermission();
  }, []);

  useEffect(() => {
    let watchId;

    if (isTracking && sessionId) {
      watchId = Geolocation.watchPosition(
        async (position) => {
          const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };

          const headers = await getAuthHeaders();
          if (headers) {
            try {
              const response = await fetch('http://10.0.2.2:3000/location/track', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                  sessionId,
                  latitude: coords.latitude,
                  longitude: coords.longitude,
                  neighborhoods: neighborhoods
                })
              });

              const data = await response.json();
              
              if (response.ok) {
                setDistance(prev => prev + data.distance);
                setSteps(prev => prev + data.steps);
                
                if (data.neighborhoodId) {
                   setVisitedNeighborhoodsCount(prev => { 
                       return prev;
                   });
                }

                if (data.captured) {
                  fetchMapState();
                }
              }
            } catch (error) {
              console.error('Error tracking location:', error);
            }
          }

          setRoute(prev => [...prev, coords]);
          setLocation(coords);
        },
        (error) => console.log('Watch error:', error),
        { enableHighAccuracy: true, distanceFilter: 5, interval: 1000, fastestInterval: 500 }
      );
    }

    return () => { if (watchId) Geolocation.clearWatch(watchId); };
  }, [isTracking, sessionId]);

  const handleStartStop = async () => {
    if (isTracking) {
      const headers = await getAuthHeaders();
      if (headers && sessionId) {
        try {
          await fetch('http://10.0.2.2:3000/location/stop-session', {
            method: 'POST', headers, body: JSON.stringify({ sessionId })
          });
        } catch (error) { console.error(error); }
      }

      setIsTracking(false);
      setSessionId(null);
      
      setTimeout(() => {
        setRoute([]);
        setDistance(0);
        setSteps(0);
        setVisitedNeighborhoodsCount(0);
      }, 100);
    } else {
      const headers = await getAuthHeaders();
      if (headers) {
        try {
          const response = await fetch('http://10.0.2.2:3000/location/start-session', {
            method: 'POST', headers
          });
          const data = await response.json();
          
          if (response.ok) {
            setSessionId(data.sessionId);
            setRoute([]);
            setDistance(0);
            setSteps(0);
            setVisitedNeighborhoodsCount(0);
            setIsTracking(true);
          }
        } catch (error) { console.error(error); }
      }
    }
  };

  if (loading) return <View style={styles.container}><ActivityIndicator size="large" color="#ffffff"/></View>;
  if (!location) return <View style={styles.container}><Text style={styles.text}>Unable to get location</Text></View>;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onRegionChangeComplete={(region) => setCurrentRegion(region)}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {neighborhoods.map(neighborhood => (
          <Polygon
            key={neighborhood.id}
            coordinates={neighborhood.coordinates}
            fillColor={getNeighborhoodColor(neighborhood.id)}
            strokeColor={getNeighborhoodStroke(neighborhood.id)}
            strokeWidth={ownerships[neighborhood.id] ? 3 : 1}
            tappable={true}
            onPress={() => handleNeighborhoodPress(neighborhood.id)}
          />
        ))}
        
        {route.length > 1 && (
          <Polyline coordinates={route} strokeColor="#0080ff" strokeWidth={6} />
        )}
      </MapView>

      <View style={styles.zoomControls}>
        <TouchableOpacity style={styles.zoomButton} onPress={handleZoomIn}>
          <Text style={styles.zoomButtonText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.zoomButton} onPress={handleZoomOut}>
          <Text style={styles.zoomButtonText}>−</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={() => setModalVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ width: '86%', backgroundColor: Colors.card, padding: 16, borderRadius: 12 }}>
            <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>
                {neighborhoods.find(n => n.id === selectedNeighborhood)?.name || 'Turf Details'}
              </Text>
              {neighborhoodDetails?.owner_color ? (
                <View style={{ width:18, height:18, borderRadius:9, backgroundColor: neighborhoodDetails.owner_color }} />
              ) : null}
            </View>

            {neighborhoodDetails ? (
              <View style={{ marginTop:10 }}>
                <Text style={{ color: '#fff', fontWeight:'700' }}>Owner: {neighborhoodDetails.owner_name}</Text>
                <Text style={{ color: Colors.muted, marginTop:6 }}>Record steps: {neighborhoodDetails.max_steps?.toLocaleString() ?? '—'}</Text>
                <Text style={{ color: Colors.muted, marginTop:6 }}>Captured: {neighborhoodDetails.captured_at ? new Date(neighborhoodDetails.captured_at).toLocaleString() : '—'}</Text>
              </View>
            ) : (
              <Text style={{ color: Colors.muted, marginTop:10 }}>No owner data</Text>
            )}

            <TouchableOpacity style={{ marginTop: 14, backgroundColor: Colors.accent, padding: 12, borderRadius: 10, alignItems: 'center' }} onPress={() => setModalVisible(false)}>
              <Text style={{ color: '#04263a', fontWeight: '800' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <TouchableOpacity 
        style={styles.leaderboardButtonTopLeft} 
        onPress={() => navigation.navigate('Leaderboard')}
      >
        <Icon name="trophy" size={24} color="#fff" />
      </TouchableOpacity>

      {isTracking && (
        <View style={styles.statsContainerTopLeft}>
          <Text style={styles.statsText}>
            Distance: {distance >= 1000 ? `${(distance / 1000).toFixed(2)} km` : `${distance.toFixed(0)} m`}
          </Text>
          <Text style={styles.statsText}>
            Steps: {steps.toLocaleString()}
          </Text>
        </View>
      )}

      <View style={styles.controls}>
        <View style={styles.controlsRow}>
          <TouchableOpacity 
            style={[styles.button, isTracking && styles.buttonStop, { flex: 1 }]} 
            onPress={handleStartStop}
          >
            <Text style={styles.buttonText}>
              {isTracking ? 'Stop Tracking' : 'Start Tracking'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  text: {
    color: '#ffffff',
    fontSize: 18,
  },
  zoomControls: {
    position: 'absolute', 
    right: 10,
    top: 70,
    gap: 10,
  },
  zoomButton: {
    backgroundColor: '#0f3460',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  zoomButtonText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '300',
  },
  controls: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#0f3460',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  buttonStop: {
    backgroundColor: '#e94560',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  controlsRow: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'stretch',
    gap: 10,
  },
  leaderboardButtonTopLeft: {
    position: 'absolute',
    top: 50,
    left: 10,
    backgroundColor: '#0f3460',
    width: 50,
    height: 50,
    borderRadius: 8, // Square-like with slight rounding
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  statsContainerTopLeft: {
    position: 'absolute',
    top: 105, // 55 (top) + 40 (height) + 10 (gap)
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  statsText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginVertical: 2,
  },
});

export default MapScreen;