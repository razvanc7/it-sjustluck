import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const Colors = {
  background: '#0b1226',
  card: '#0f2038',
  accent: '#06b6d4',
  accent2: '#0ea5a4',
  muted: '#94a3b8',
  danger: '#ef4444'
};

export const Avatar = ({ name, size = 44, color }) => {
  const initials = name ? name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase() : 'U';
  const bg = color || '#334155';
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size/2, backgroundColor: bg }] }>
      <Text style={[styles.avatarText, { fontSize: size/2.4 }]}>{initials}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  avatar: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700'
  }
});

export default {
  Colors,
  Avatar
};
