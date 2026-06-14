import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { StoryType, storyApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function StoryViewer({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [stories, setStories] = useState<StoryType[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStories();
  }, []);

  const loadStories = async () => {
    try {
      const { data } = await storyApi.getActive();
      const mine = await storyApi.getMine();
      const combined = [...mine.data, ...data];
      setStories(combined);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const current = stories[currentIndex];
  const isOwn = current?.userId === user?.id;

  const goNext = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      onClose();
    }
  }, [currentIndex, stories.length, onClose]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  }, [currentIndex]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!current) {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: current.url }}
        style={styles.image}
        resizeMode="contain"
      />
      <TouchableOpacity style={styles.leftHit} onPress={goPrev} />
      <TouchableOpacity style={styles.rightHit} onPress={goNext} />
      <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
        <Ionicons name="close" size={28} color="#fff" />
      </TouchableOpacity>
      {isOwn && (
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={async () => {
            await storyApi.delete(current.id);
            const filtered = stories.filter((s) => s.id !== current.id);
            setStories(filtered);
            if (filtered.length === 0) onClose();
          }}
        >
          <Ionicons name="trash" size={22} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  leftHit: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '30%',
    height: '100%',
  },
  rightHit: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: '70%',
    height: '100%',
  },
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: {
    position: 'absolute',
    top: 50,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
