import React, { useState } from 'react';
import { Text, StyleSheet, TouchableOpacity, View, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import Theme, { Colors } from '../components/Theme';

const RegisterScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'All fields are required');
      return;
    }
    
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
        const registrationUrl = 'http://10.0.2.2:3000/auth/register';
        const payload = { name, email, password };
        
        const response = await fetch(registrationUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (response.ok) {
            Alert.alert('Success', 'Registration successful! Please log in.');
            navigation.replace('MainTabs'); 
        } else {
            Alert.alert('Error', data.error || 'Registration failed');
        }
    } catch (error) {
        Alert.alert('Error', 'Could not connect to the server');
        console.error("Registration error:", error);
    } finally {
        setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Join the turfing community</Text>
      </View>

      <View style={styles.formContainer}>
        <TextInput
          style={styles.input}
          placeholder="Name"
          placeholderTextColor="#999"
          value={name}
          onChangeText={setName}
        />
        
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#999"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#999"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        
        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          placeholderTextColor="#999"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />
        
        <TouchableOpacity 
          style={styles.button} 
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.background} />
          ) : (
            <Text style={styles.buttonText}>Create</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.linkText}>Already have an account?</Text>
            <Text style={styles.linkAction}> Login</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: Colors.background,
    padding: 20,
  },
  header: { alignItems: 'center', marginBottom: 18 },
  title: { color: '#fff', fontSize: 26, fontWeight: '800' },
  subtitle: { color: Colors.muted, marginTop: 6 },
  formContainer: {
    width: '100%',
    gap: 16,
    maxWidth: 400,
  },
  input: {
    backgroundColor: Colors.card,
    color: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: Colors.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#04263a',
    fontSize: 18,
    fontWeight: '800',
  },
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 14 },
  linkText: { color: Colors.muted },
  linkAction: { color: Colors.accent, fontWeight: '700' }
});

export default RegisterScreen;