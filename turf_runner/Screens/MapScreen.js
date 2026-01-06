import React, { useEffect, useState, useRef, useCallback } from 'react';
import { StyleSheet, View, ActivityIndicator, Platform, PermissionsAndroid, Text, TouchableOpacity } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Polyline, Polygon } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { neighborhoods } from '../data/neighborhoods';

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

  const fetchMapState = async () => {
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
            color: item.owner_color,
            owner: item.owner_name
          };
        });
      }
      setOwnerships(newOwnerships);
    } catch (err) {
      console.error("Failed to load map owner colors", err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchMapState();
    }, [])
  );

  const getAuthHeaders = async () => {
    const token = await AsyncStorage.getItem('userToken');
    return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : null;
  };

  const getNeighborhoodColor = (neighborhoodId) => {
    if (ownerships[neighborhoodId]) {
      return ownerships[neighborhoodId].color + '80'; 
    }
    return 'rgba(200, 200, 200, 0.1)';
  };

  const getNeighborhoodStroke = (neighborhoodId) => {
    if (ownerships[neighborhoodId]) {
      return ownerships[neighborhoodId].color;
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

      <View style={styles.controls}>
        <TouchableOpacity 
          style={[styles.button, isTracking && styles.buttonStop]} 
          onPress={handleStartStop}
        >
          <Text style={styles.buttonText}>
            {isTracking ? 'Stop Tracking' : 'Start Tracking'}
          </Text>
        </TouchableOpacity>
        
        {isTracking && (
          <View style={styles.statsContainer}>
            <Text style={styles.statsText}>
              Distance: {distance >= 1000 ? `${(distance / 1000).toFixed(2)} km` : `${distance.toFixed(0)} m`}
            </Text>
            <Text style={styles.statsText}>
              Steps: {steps.toLocaleString()}
            </Text>
          </View>
        )}
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
    top: 55,
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
  statsContainer: {
    position: 'absolute',
    top: -725,
    left: 0,
    marginTop: 40,
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