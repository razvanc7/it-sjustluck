import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';
import WelcomeScreen from './Screens/WelcomeScreen';
import LoginScreen from './Screens/LoginScreen';
import RegisterScreen from './Screens/RegisterScreen';
import MapScreen from './Screens/MapScreen';
import ProfileScreen from './Screens/ProfileScreen'; 
import FriendsScreen from './Screens/FriendsScreen'; 

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator(); 

const MainTabs = () => {
  return (
    <Tab.Navigator
      initialRouteName="Map"
      screenOptions={{
        headerShown: false, 
        tabBarActiveTintColor: '#3498db', 
        tabBarInactiveTintColor: '#999',  
        tabBarStyle: {
          backgroundColor: '#0f3460', 
          borderTopWidth: 0,
          paddingBottom: 20,
          paddingTop: 5,
          height: 80, 
        },
        tabBarLabelStyle: {
          fontSize: 12,
          paddingBottom: 5,
        },
        tabBarIconStyle: {
          marginTop: 5,
        }
      }}
    >
      <Tab.Screen 
        name="Map" 
        component={MapScreen}
        options={{ 
          title: 'Map',
          tabBarIcon: ({ color, size }) => (
            <Icon name="map" size={size || 24} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{ 
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Icon name="person" size={size || 24} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="Friends" 
        component={FriendsScreen}
        options={{ 
          title: 'Friends',
          tabBarIcon: ({ color, size }) => (
            <Icon name="people" size={size || 24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const App = () => (
  <SafeAreaProvider>
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Welcome"
        screenOptions={{
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#ffffff',
          headerTitleStyle: { fontWeight: '600' },
        }}
      >
        <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }}/>
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }}/>
        <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }}/>
        <Stack.Screen 
          name="MainApp"
          component={MainTabs}
          options={{ headerShown: false }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  </SafeAreaProvider>
);

export default App;