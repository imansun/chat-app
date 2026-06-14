import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCall } from '../context/CallContext';
import { useTheme } from '../context/ThemeContext';

export default function IncomingCallScreen() {
  const { call, acceptCall, rejectCall } = useCall();
  const { colors } = useTheme();

  if (call.status !== 'ringing' || !call.remoteUser) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.primaryDark }]}>
      <View style={styles.content}>
        {call.remoteUser.avatar ? (
          <Image source={{ uri: call.remoteUser.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>
              {call.remoteUser.username.substring(0, 2).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.name}>{call.remoteUser.username}</Text>
        <Text style={styles.info}>
          {call.type === 'video' ? 'Video call' : 'Voice call'}
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.rejectBtn} onPress={rejectCall}>
          <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.acceptBtn} onPress={acceptCall}>
          <Ionicons name="call" size={32} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    justifyContent: 'space-between',
    paddingTop: 80,
    paddingBottom: 60,
  },
  content: { alignItems: 'center' },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 20,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarText: { color: '#fff', fontSize: 40, fontWeight: 'bold' },
  name: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
  info: { color: '#ddd', fontSize: 16 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 60,
  },
  rejectBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ff4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
