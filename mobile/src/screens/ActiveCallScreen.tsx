import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCall } from '../context/CallContext';

let RTCView: any = null;
if (Platform.OS !== 'web') {
  try {
    RTCView = require('react-native-webrtc').RTCView;
  } catch {}
}

export default function ActiveCallScreen() {
  const {
    call,
    endCall,
    toggleMute,
    toggleSpeaker,
    toggleVideo,
    isMuted,
    isSpeakerOn,
    isVideoOn,
    localStream,
  } = useCall();

  if (call.status === 'idle') return null;

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      {call.type === 'video' && localStream && (
        <RTCView
          streamURL={localStream.toURL()}
          style={styles.localVideo}
          zOrder={1}
          objectFit="cover"
        />
      )}

      <View style={styles.info}>
        <Text style={styles.name}>{call.remoteUser?.username || 'Calling...'}</Text>
        <Text style={styles.status}>
          {call.status === 'connecting'
            ? 'Connecting...'
            : call.status === 'active'
            ? formatDuration(call.duration)
            : 'Call ended'}
        </Text>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
          onPress={toggleMute}
        >
          <Ionicons
            name={isMuted ? 'mic-off' : 'mic'}
            size={28}
            color={isMuted ? '#ff4444' : '#fff'}
          />
        </TouchableOpacity>

        {call.type === 'video' && (
          <TouchableOpacity
            style={[styles.controlBtn, !isVideoOn && styles.controlBtnActive]}
            onPress={toggleVideo}
          >
            <Ionicons
              name={isVideoOn ? 'videocam' : 'videocam-off'}
              size={28}
              color={!isVideoOn ? '#ff4444' : '#fff'}
            />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.controlBtn, isSpeakerOn && styles.controlBtnActive]}
          onPress={toggleSpeaker}
        >
          <Ionicons
            name={isSpeakerOn ? 'volume-high' : 'volume-mute'}
            size={28}
            color={isSpeakerOn ? '#4CAF50' : '#fff'}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.endCallBtn} onPress={endCall}>
          <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    backgroundColor: '#1a1a2e',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 40,
  },
  localVideo: {
    position: 'absolute',
    top: 50,
    right: 16,
    width: 100,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    zIndex: 10,
  },
  info: { alignItems: 'center', marginTop: 40 },
  name: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  status: { color: '#aaa', fontSize: 16, marginTop: 8 },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    paddingHorizontal: 20,
  },
  controlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  endCallBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ff4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
