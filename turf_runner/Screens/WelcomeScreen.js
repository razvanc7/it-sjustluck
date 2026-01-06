import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  View, 
  Animated, 
  Dimensions,
  StatusBar,
  Easing 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

const WelcomeScreen = ({ navigation }) => {
  // 1. STATE
  const [activeTransition, setActiveTransition] = useState(null);

  // 2. REFS (Animations)
  const anim = useRef({
    fade: new Animated.Value(0),
    slide: new Animated.Value(50),
    scale: new Animated.Value(0.3),
    bg1: new Animated.Value(0),
    bg2: new Animated.Value(0),
    expand1: new Animated.Value(0),
    expand2: new Animated.Value(0),
  }).current;

  // 3. EFFECTS
  useFocusEffect(
    useCallback(() => {
      anim.expand1.setValue(0);
      anim.expand2.setValue(0);
      setActiveTransition(null);
    }, [])
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(anim.fade, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(anim.slide, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(anim.scale, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    const loopAnim = (val, duration) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, {
            toValue: 1,
            duration: duration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: duration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    loopAnim(anim.bg1, 4000);
    loopAnim(anim.bg2, 5000);
  }, []);

  // 4. HANDLERS
  const handleLogin = () => {
    setActiveTransition('login');
    Animated.timing(anim.expand1, {
      toValue: 1,
      duration: 500,
      easing: Easing.bezier(0.4, 0.0, 0.2, 1),
      useNativeDriver: true,
    }).start(() => {
      navigation.navigate('Login');
    });
  };

  const handleRegister = () => {
    setActiveTransition('register');
    Animated.timing(anim.expand2, {
      toValue: 1,
      duration: 500,
      easing: Easing.bezier(0.4, 0.0, 0.2, 1),
      useNativeDriver: true,
    }).start(() => {
      navigation.navigate('Register');
    });
  };

  // 5. INTERPOLATIONS
  const expandedScale = 35;

  const circle1Transform = {

    opacity: anim.expand1.interpolate({
      inputRange: [0, 0.2], 
      outputRange: [0.6, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      { 
        translateY: anim.bg1.interpolate({ 
          inputRange: [0, 1], 
          outputRange: [0, 60] 
        }) 
      },
      { 
        scale: Animated.add(
          anim.bg1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] }),
          anim.expand1.interpolate({ inputRange: [0, 1], outputRange: [0, expandedScale] })
        )
      }
    ]
  };

  const circle2Transform = {

    opacity: anim.expand2.interpolate({
      inputRange: [0, 0.2], 
      outputRange: [0.7, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      { 
        translateY: anim.bg2.interpolate({ 
          inputRange: [0, 1], 
          outputRange: [0, -70] 
        }) 
      },
      { 
        scale: Animated.add(
          anim.bg2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }),
          anim.expand2.interpolate({ inputRange: [0, 1], outputRange: [0, expandedScale] })
        )
      }
    ]
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      
      {/* Background Circle 1 (Top Right) */}
      <Animated.View 
        style={[
          styles.circle1, 
          circle1Transform,
          activeTransition === 'login' ? styles.topZIndex : null
        ]} 
      />
      
      {/* Background Circle 2 (Bottom Left) */}
      <Animated.View 
        style={[
          styles.circle2, 
          circle2Transform,
          activeTransition === 'register' ? styles.topZIndex : null
        ]} 
      />

      <View style={styles.contentContainer}>
        <Animated.View style={[styles.logoContainer, { 
          opacity: anim.fade, 
          transform: [{ scale: anim.scale }] 
        }]}>
           <View style={styles.simpleGlowCircle}>
             <Text style={styles.logoEmoji}>🏃‍♂️</Text>
           </View>
        </Animated.View>

        <Animated.View style={[styles.textContainer, { 
          opacity: anim.fade, 
          transform: [{ translateY: anim.slide }] 
        }]}>
          <Text style={styles.welcomeText}>Welcome to</Text>
          <Text style={styles.titleText}>TURF RUNNER</Text>
          <Text style={styles.tagline}>Claim Your Territory. Run Your City.</Text>
        </Animated.View>
        
        <Animated.View style={[styles.buttonContainer, { 
          opacity: anim.fade,
          transform: [{ translateY: anim.slide }] 
        }]}>
          <TouchableOpacity 
            style={styles.loginButton} 
            onPress={handleLogin}
            activeOpacity={0.8}
            disabled={activeTransition !== null}
          >
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.registerButton} 
            onPress={handleRegister}
            activeOpacity={0.8}
            disabled={activeTransition !== null}
          >
            <Text style={styles.registerButtonText}>Create Account</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    overflow: 'hidden',
  },
  topZIndex: {
    zIndex: 1000,
    elevation: 1000,
  },
  circle1: {
    position: 'absolute',
    top: -50,
    right: -80,
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: '#27496d', 
  },
  circle2: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#052041ff',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 1,
  },
  logoContainer: {
    marginBottom: 30,
    alignItems: 'center',
  },
  simpleGlowCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(79, 195, 247, 0.15)', 
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4fc3f7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 15,
  },
  logoEmoji: {
    fontSize: 70, 
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  welcomeText: {
    color: '#a0a0a0',
    fontSize: 20,
    fontWeight: '400',
    marginBottom: 5,
    letterSpacing: 1,
  },
  titleText: {
    color: '#ffffff',
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: 1,
    textShadowColor: 'rgba(79, 195, 247, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  tagline: {
    color: '#4fc3f7',
    fontSize: 16,
    marginTop: 10,
    fontWeight: '500',
    opacity: 0.9,
  },
  buttonContainer: {
    width: '100%',
    gap: 16,
    paddingHorizontal: 20,
  },
  loginButton: {
    backgroundColor: '#0452b0',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0452b0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  registerButton: {
    backgroundColor: 'rgba(15, 52, 96, 0.6)', 
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4fc3f7',
  },
  registerButtonText: {
    color: '#4fc3f7',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0
  },
});

export default WelcomeScreen;