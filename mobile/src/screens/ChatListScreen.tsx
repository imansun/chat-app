import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { chatApi, userApi, Room, User } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function ChatListScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);

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
      return `${msg.sender?.username || ''}: ${msg.content.substring(0, 30)}`;
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

    return (
      <TouchableOpacity
        style={styles.roomItem}
        onPress={() => navigation.navigate('Chat', { room: item })}
      >
        <View style={styles.avatarWrapper}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {getRoomName(item).substring(0, 2).toUpperCase()}
            </Text>
          </View>
          {!item.isGroup && isOnline && <View style={styles.onlineDot} />}
        </View>
        <View style={styles.roomInfo}>
          <Text style={styles.roomName}>{getRoomName(item)}</Text>
          <Text style={styles.lastMessage}>{getLastMessage(item)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#075E54" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chat App</Text>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logout}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search users..."
          placeholderTextColor="#888"
          value={searchQuery}
          onChangeText={handleSearch}
        />
      </View>

      {searchQuery.length >= 2 && (
        <View style={styles.searchResults}>
          {searching ? (
            <ActivityIndicator size="small" color="#075E54" />
          ) : searchResults.length === 0 ? (
            <Text style={styles.noResults}>No users found</Text>
          ) : (
            searchResults.map((u) => (
              <TouchableOpacity
                key={u.id}
                style={styles.searchItem}
                onPress={() => startPrivateChat(u)}
              >
                <View style={styles.searchAvatar}>
                  <Text style={styles.avatarText}>
                    {u.username.substring(0, 2).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.searchName}>{u.username}</Text>
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
          <Text style={styles.emptyText}>
            No conversations yet. Search for users above!
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ECE5DD' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#075E54',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  logout: { color: '#fff', fontSize: 14 },
  searchContainer: { padding: 8, backgroundColor: '#075E54' },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
  },
  searchResults: {
    backgroundColor: '#fff',
    marginHorizontal: 8,
    borderRadius: 8,
    padding: 8,
    maxHeight: 200,
  },
  noResults: { textAlign: 'center', color: '#888', padding: 10 },
  searchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  searchAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#075E54',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  searchName: { fontSize: 16, color: '#333' },
  roomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: '#ddd',
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
    backgroundColor: '#075E54',
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
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  roomInfo: { flex: 1 },
  roomName: { fontSize: 16, fontWeight: '600', color: '#333' },
  lastMessage: { fontSize: 13, color: '#666', marginTop: 2 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#888', fontSize: 14, textAlign: 'center', padding: 40 },
});
