import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { chatApi, userApi, storyApi, Room, User } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import StoryViewer from '../components/StoryViewer';

export default function ChatListScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const { isDark, colors, toggleTheme } = useTheme();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [creatingStory, setCreatingStory] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchRooms();
    }, [])
  );

  const fetchRooms = async () => {
    try {
      const { data } = await chatApi.getRooms();
      setRooms(data);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to load chats');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const { data } = await userApi.search(q);
      setSearchResults(data.filter((u) => u.id !== user?.id));
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleUpdateAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (result.canceled || !result.assets[0]) return;

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', {
        uri: result.assets[0].uri,
        type: 'image/jpeg',
        name: 'avatar.jpg',
      } as any);
      await userApi.updateProfile(formData);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to update avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCreateStory = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    setCreatingStory(true);
    try {
      await storyApi.create(result.assets[0].uri);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to create story');
    } finally {
      setCreatingStory(false);
    }
  };

  const startPrivateChat = async (targetUser: User) => {
    try {
      const { data } = await chatApi.createPrivate(targetUser.id);
      navigation.navigate('Chat', { room: data });
      setSearchQuery('');
      setSearchResults([]);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to create chat');
    }
  };

  const getRoomName = (room: Room) => {
    if (room.name) return room.name;
    const other = room.participants?.find((p) => p.id !== user?.id);
    return other?.username || 'Unknown';
  };

  const getLastMessage = (room: Room) => {
    if (room.lastMessage) {
      const msg = room.lastMessage;
      const prefix = msg.sender?.username ? `${msg.sender.username}: ` : '';
      return `${prefix}${msg.content.substring(0, 30)}`;
    }
    return 'No messages yet';
  };

  const getOtherParticipant = (room: Room) => {
    if (room.isGroup) return null;
    return room.participants?.find((p) => p.id !== user?.id) || null;
  };

  const renderRoom = ({ item }: { item: Room }) => {
    const other = getOtherParticipant(item);
    const isOnline = other?.isOnline || false;

    const otherAvatar = !item.isGroup ? other?.avatar : null;

    return (
      <TouchableOpacity
        style={[styles.roomItem, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
        onPress={() => navigation.navigate('Chat', { room: item })}
      >
        <View style={styles.avatarWrapper}>
          {otherAvatar ? (
            <Image source={{ uri: otherAvatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>
                {getRoomName(item).substring(0, 2).toUpperCase()}
              </Text>
            </View>
          )}
          {!item.isGroup && isOnline && (
            <View style={[styles.onlineDot, { borderColor: colors.surface, backgroundColor: colors.online }]} />
          )}
        </View>
        <View style={styles.roomInfo}>
          <Text style={[styles.roomName, { color: colors.text }]}>{getRoomName(item)}</Text>
          <Text style={[styles.lastMessage, { color: colors.textSecondary }]}>{getLastMessage(item)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={handleUpdateAvatar} disabled={uploadingAvatar}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.userAvatar} />
            ) : (
              <View style={[styles.userAvatarPlaceholder, { backgroundColor: colors.primaryDark }]}>
                <Text style={styles.userAvatarText}>
                  {user?.username?.substring(0, 2).toUpperCase() || 'U'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textInverse }]}>Chat App</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={toggleTheme} style={styles.headerBtn}>
            <Ionicons name={isDark ? 'sunny' : 'moon'} size={20} color={colors.textInverse} />
          </TouchableOpacity>
          <TouchableOpacity onPress={logout}>
            <Text style={[styles.logout, { color: colors.textInverse }]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.storyRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.storyItem} onPress={handleCreateStory} disabled={creatingStory}>
          <View style={[styles.storyAvatar, { borderColor: colors.primary }]}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.storyAvatarImg} />
            ) : (
              <View style={[styles.storyAvatarPlaceholder, { backgroundColor: colors.primary }]}>
                <Ionicons name="add" size={20} color="#fff" />
              </View>
            )}
          </View>
          <Text style={[styles.storyLabel, { color: colors.textSecondary }]}>My Status</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.storyItem} onPress={() => setShowStoryViewer(true)}>
          <View style={[styles.storyAvatar, { borderColor: colors.online }]}>
            <Ionicons name="eye" size={20} color={colors.textSecondary} />
          </View>
          <Text style={[styles.storyLabel, { color: colors.textSecondary }]}>View All</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.searchContainer, { backgroundColor: colors.headerBg }]}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: colors.inputBg, color: colors.text }]}
          placeholder="Search users..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={handleSearch}
        />
      </View>

      {searchQuery.length >= 2 && (
        <View style={[styles.searchResults, { backgroundColor: colors.surface }]}>
          {searching ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : searchResults.length === 0 ? (
            <Text style={[styles.noResults, { color: colors.textSecondary }]}>No users found</Text>
          ) : (
            searchResults.map((u) => (
              <TouchableOpacity
                key={u.id}
                style={[styles.searchItem, { borderBottomColor: colors.border }]}
                onPress={() => startPrivateChat(u)}
              >
                <View style={[styles.searchAvatar, { backgroundColor: colors.primary }]}>
                  <Text style={styles.avatarText}>
                    {u.username.substring(0, 2).toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.searchName, { color: colors.text }]}>{u.username}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}

      <FlatList
        data={rooms}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderRoom}
        contentContainerStyle={rooms.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No conversations yet. Search for users above!
          </Text>
        }
      />

      {showStoryViewer && (
        <StoryViewer onClose={() => setShowStoryViewer(false)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', marginLeft: 10 },
  userAvatar: { width: 36, height: 36, borderRadius: 18 },
  userAvatarPlaceholder: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  userAvatarText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  logout: { fontSize: 14 },
  storyRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  storyItem: { alignItems: 'center', marginRight: 20 },
  storyAvatar: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 2,
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  storyAvatarImg: { width: 48, height: 48, borderRadius: 24 },
  storyAvatarPlaceholder: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
  },
  storyLabel: { fontSize: 11, marginTop: 4 },
  searchContainer: { padding: 8 },
  searchInput: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
  },
  searchResults: {
    marginHorizontal: 8,
    borderRadius: 8,
    padding: 8,
    maxHeight: 200,
  },
  noResults: { textAlign: 'center', padding: 10 },
  searchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
  },
  searchAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  searchName: { fontSize: 16 },
  roomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 0.5,
  },
  avatarWrapper: {
    width: 48,
    height: 48,
    marginRight: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  roomInfo: { flex: 1 },
  roomName: { fontSize: 16, fontWeight: '600' },
  lastMessage: { fontSize: 13, marginTop: 2 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center', padding: 40 },
});
