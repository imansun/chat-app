import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useCall } from '../context/CallContext';
import { connectSocket, disconnectSocket } from '../services/socket';
import { chatApi, voiceApi, Message, Room } from '../services/api';
import { getKeyPair, encryptMessage, decryptMessage } from '../services/e2ee';
import { Socket } from 'socket.io-client';

const MESSAGES_LIMIT = 50;

export default function ChatScreen({ route }: any) {
  const { room: initialRoom } = route.params;
  const { user } = useAuth();
  const { colors } = useTheme();
  const { startCall } = useCall();
  const [room, setRoom] = useState<Room>(initialRoom);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [socketConnected, setSocketConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [recording, setRecording] = useState<any | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<number | null>(null);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    initSocket();
    fetchMessages();
    return () => {
      disconnectSocket();
    };
  }, []);

  useEffect(() => {
    if (!loadingMessages && messages.length > 0) {
      markMessagesAsRead();
    }
  }, [loadingMessages, messages.length]);

  const initSocket = async () => {
    try {
      const socket = await connectSocket();
      socketRef.current = socket;

      socket.on('connect', () => setSocketConnected(true));
      socket.on('disconnect', () => setSocketConnected(false));

      if (socket.connected) {
        setSocketConnected(true);
      }

      socket.emit('room:join', room.id);

      socket.on('message:new', async (message: Message) => {
        if (message.isEncrypted && message.senderId !== user?.id) {
          const kp = await getKeyPair();
          if (kp) {
            const decrypted = await decryptMessage(message.content, message.senderId, kp);
            if (decrypted) message.content = decrypted;
          }
        }
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev;
          return [message, ...prev];
        });
      });

      socket.on('message:read', ({ messageId }: { messageId: number }) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, isRead: true } : m)),
        );
      });

      socket.on('message:edited', async ({ messageId, content, isEdited: editedFlag }: { messageId: number; content: string; isEdited: boolean }) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, content, isEdited: true } : m)),
        );
      });

      socket.on('message:deleted', ({ messageId }: { messageId: number }) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, isDeleted: true, content: 'This message was deleted' }
              : m,
          ),
        );
      });

      socket.on('typing:start', ({ userId: typingUserId }: { userId: number }) => {
        if (typingUserId !== user?.id) {
          setTypingUsers((prev) => new Set(prev).add(typingUserId));
        }
      });

      socket.on('typing:stop', ({ userId: typingUserId }: { userId: number }) => {
        setTypingUsers((prev) => {
          const next = new Set(prev);
          next.delete(typingUserId);
          return next;
        });
      });
    } catch {
      setSocketConnected(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const [{ data: roomData }, { data: messagesData }] = await Promise.all([
        chatApi.getRoom(room.id),
        chatApi.getRoomMessages(room.id, MESSAGES_LIMIT, 0),
      ]);
      setRoom(roomData);

      const kp = await getKeyPair();
      const decrypted = await Promise.all(
        messagesData.map(async (msg) => {
          if (msg.isEncrypted && msg.senderId !== user?.id && kp) {
            const d = await decryptMessage(msg.content, msg.senderId, kp);
            if (d) msg.content = d;
          }
          return msg;
        }),
      );

      setMessages(decrypted);
      setHasMore(messagesData.length >= MESSAGES_LIMIT);
      setOffset(messagesData.length);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to load messages');
    } finally {
      setLoadingMessages(false);
    }
  };

  const markMessagesAsRead = () => {
    if (!socketRef.current) return;
    const unread = messages.filter(
      (m) => m.senderId !== user?.id && !m.isRead,
    );
    unread.forEach((m) => {
      socketRef.current?.emit('message:read', {
        messageId: m.id,
        roomId: room.id,
      });
    });
  };

  const loadMore = async () => {
    if (!hasMore || loadingMore || loadingMessages) return;
    setLoadingMore(true);
    try {
      const { data } = await chatApi.getRoomMessages(room.id, MESSAGES_LIMIT, offset);
      const kp = await getKeyPair();
      const decrypted = await Promise.all(
        data.map(async (msg) => {
          if (msg.isEncrypted && msg.senderId !== user?.id && kp) {
            const d = await decryptMessage(msg.content, msg.senderId, kp);
            if (d) msg.content = d;
          }
          return msg;
        }),
      );
      setMessages((prev) => [...prev, ...decrypted]);
      setHasMore(data.length >= MESSAGES_LIMIT);
      setOffset((prev) => prev + data.length);
    } catch {
    } finally {
      setLoadingMore(false);
    }
  };

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || !socketRef.current) return;

    if (editingMessage) {
      socketRef.current.emit('message:edit', {
        messageId: editingMessage.id,
        content: text,
        roomId: room.id,
      });
      setEditingMessage(null);
    } else {
      const kp = await getKeyPair();
      let content = text;
      if (kp && !room.isGroup) {
        const other = room.participants?.find((p) => p.id !== user?.id);
        if (other) {
          const encrypted = await encryptMessage(text, other.id, kp);
          if (encrypted) content = encrypted;
        }
      }
      socketRef.current.emit('message:send', {
        roomId: room.id,
        content,
        isEncrypted: content !== text,
      });
    }

    setInputText('');
    socketRef.current.emit('typing:stop', {
      roomId: room.id,
      username: user?.username,
    });
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });

    if (result.canceled || !result.assets[0]) return;

    try {
      const { data } = await chatApi.uploadImage(room.id, result.assets[0].uri);
      setMessages((prev) => [data, ...prev]);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to send image');
    }
  };

  const startRecording = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not available', 'Voice recording is not supported on web');
      return;
    }
    try {
      const { Audio } = require('expo-av');
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow microphone access to record voice');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      setRecording(newRecording);
      setIsRecording(true);
    } catch {
      Alert.alert('Error', 'Could not start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setIsRecording(false);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) return;

      setUploadingVoice(true);
      const { data } = await voiceApi.upload(room.id, uri);
      setMessages((prev) => [data, ...prev]);
    } catch {
      Alert.alert('Error', 'Failed to send voice message');
    } finally {
      setUploadingVoice(false);
    }
  };

  const playVoice = async (messageId: number, audioUrl: string) => {
    if (Platform.OS === 'web') {
      const audio = new window.Audio(audioUrl);
      audio.play().catch(() => {});
      return;
    }
    try {
      const { Audio } = require('expo-av');
      if (playingAudio === messageId) {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        setPlayingAudio(null);
        return;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true },
      );
      setPlayingAudio(messageId);
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded && !status.isPlaying) {
          setPlayingAudio(null);
        }
      });
    } catch {
      Alert.alert('Error', 'Could not play voice message');
    }
  };

  const handleLongPress = (message: Message) => {
    if (message.senderId !== user?.id) return;
    setSelectedMessage(message);
    setMenuVisible(true);
  };

  const handleEdit = () => {
    if (!selectedMessage) return;
    setInputText(selectedMessage.content);
    setEditingMessage(selectedMessage);
    setMenuVisible(false);
    setSelectedMessage(null);
  };

  const handleDelete = () => {
    if (!selectedMessage) return;
    Alert.alert('Delete Message', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await chatApi.deleteMessage(selectedMessage.id);
            socketRef.current?.emit('message:delete', {
              messageId: selectedMessage.id,
              roomId: room.id,
            });
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to delete');
          }
        },
      },
    ]);
    setMenuVisible(false);
    setSelectedMessage(null);
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setInputText('');
  };

  const handleTyping = (text: string) => {
    setInputText(text);
    if (!socketRef.current) return;

    if (text.length > 0) {
      socketRef.current.emit('typing:start', {
        roomId: room.id,
        username: user?.username,
      });
    } else {
      socketRef.current.emit('typing:stop', {
        roomId: room.id,
        username: user?.username,
      });
    }
  };

  const getRoomName = () => {
    if (room.name) return room.name;
    const other = room.participants?.find((p) => p.id !== user?.id);
    return other?.username || 'Chat';
  };

  const getOtherAvatar = () => {
    const other = room.participants?.find((p) => p.id !== user?.id);
    return other?.avatar || null;
  };

  const isOtherOnline = () => {
    if (room.isGroup) return false;
    const other = room.participants?.find((p) => p.id !== user?.id);
    return other?.isOnline || false;
  };

  const renderMessage = useCallback(({ item }: { item: Message }) => {
    const isMine = item.senderId === user?.id;
    const time = new Date(item.createdAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (item.isDeleted) {
      return (
        <View style={[styles.messageRow, isMine && styles.myMessageRow]}>
          <View style={[styles.messageBubble, { backgroundColor: colors.border }, styles.deletedBubble]}>
            <Text style={[styles.deletedText, { color: colors.textSecondary }]}>This message was deleted</Text>
          </View>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.messageRow, isMine && styles.myMessageRow]}
        onLongPress={() => handleLongPress(item)}
        delayLongPress={500}
      >
        <View style={[
          styles.messageBubble,
          isMine
            ? { backgroundColor: colors.bubbleMine }
            : { backgroundColor: colors.bubbleOther },
        ]}>
          {!isMine && (
            <Text style={[styles.senderName, { color: colors.primary }]}>{item.sender?.username}</Text>
          )}
          {item.type === 'image' ? (
            <Image
              source={{ uri: item.content }}
              style={styles.messageImage}
              resizeMode="cover"
            />
          ) : item.type === 'voice' ? (
            <TouchableOpacity
              style={[styles.voiceBubble, { backgroundColor: colors.surface }]}
              onPress={() => playVoice(item.id, item.content)}
            >
              <Ionicons
                name={playingAudio === item.id ? 'pause-circle' : 'play-circle'}
                size={28}
                color={colors.primary}
              />
              <Text style={[styles.voiceText, { color: colors.text }]}>Voice message</Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.messageText, { color: colors.text }]}>
              {item.content}
            </Text>
          )}
          <View style={styles.messageFooter}>
            {item.isEdited && !item.isDeleted && (
              <Text style={[styles.edited, { color: colors.textSecondary }]}>edited </Text>
            )}
            {item.isEncrypted && (
              <Ionicons name="lock-closed" size={10} color={colors.textSecondary} style={{ marginRight: 2 }} />
            )}
            <Text style={[styles.time, { color: colors.textSecondary }]}>{time}</Text>
            {isMine && (
              <Text style={[styles.status, item.isRead && { color: colors.online }]}>
                {item.isRead ? '\u2713\u2713' : '\u2713'}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [user?.id, colors, playingAudio]);

  const otherParticipants = room.participants?.filter((p) => p.id !== user?.id) || [];
  const typingNames = Array.from(typingUsers)
    .map((id) => otherParticipants.find((p) => p.id === id)?.username)
    .filter(Boolean);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'web' ? undefined : undefined}
    >
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <View style={styles.headerInfo}>
          <View style={styles.headerRow}>
            {getOtherAvatar() ? (
              <Image source={{ uri: getOtherAvatar()! }} style={styles.headerAvatar} />
            ) : (
              <View style={[styles.headerAvatarPlaceholder, { backgroundColor: colors.primaryDark }]}>
                <Text style={styles.headerAvatarText}>
                  {getRoomName().substring(0, 2).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.headerText}>
              <Text style={[styles.headerTitle, { color: colors.textInverse }]}>{getRoomName()}</Text>
              {!room.isGroup && (
                <View style={styles.e2eeRow}>
                  <Ionicons name="lock-closed" size={10} color={colors.online} />
                  <Text style={[styles.e2eeLabel, { color: colors.online }]}> End-to-end encrypted</Text>
                </View>
              )}
              {!room.isGroup && isOtherOnline() && !typingNames.length && (
                <Text style={[styles.onlineStatus, { color: colors.background }]}>online</Text>
              )}
              {!socketConnected && (
                <Text style={styles.disconnected}>Connecting...</Text>
              )}
              {typingNames.length > 0 && (
                <Text style={[styles.typingText, { color: colors.background }]}>
                  {typingNames.join(', ')} typing...
                </Text>
              )}
            </View>
            {!room.isGroup && (
              <View style={styles.callActions}>
                <TouchableOpacity
                  style={styles.callBtn}
                  onPress={() => {
                    const other = room.participants?.find((p) => p.id !== user?.id);
                    if (other) startCall(other, 'audio');
                  }}
                >
                  <Ionicons name="call" size={20} color={colors.textInverse} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.callBtn}
                  onPress={() => {
                    const other = room.participants?.find((p) => p.id !== user?.id);
                    if (other) startCall(other, 'video');
                  }}
                >
                  <Ionicons name="videocam" size={20} color={colors.textInverse} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>

      {loadingMessages ? (
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMessage}
          style={styles.messagesList}
          inverted
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          contentContainerStyle={styles.messagesContent}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadingMore}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyMessages}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No messages yet. Say hi!</Text>
            </View>
          }
        />
      )}

      <View style={[styles.inputContainer, { backgroundColor: colors.inputBg, borderTopColor: colors.border }]}>
        {editingMessage && (
          <TouchableOpacity onPress={cancelEdit} style={styles.cancelEdit}>
            <Text style={[styles.cancelEditText, { color: colors.primary }]}>Cancel</Text>
          </TouchableOpacity>
        )}
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
          placeholder={editingMessage ? 'Edit message...' : 'Type a message...'}
          placeholderTextColor={colors.textSecondary}
          value={inputText}
          onChangeText={handleTyping}
          multiline
        />
        <TouchableOpacity style={[styles.iconButton, { backgroundColor: colors.primary }]} onPress={pickImage}>
          <Ionicons name="image" size={18} color="#fff" />
        </TouchableOpacity>
        {uploadingVoice ? (
          <View style={[styles.iconButton, { backgroundColor: colors.primary }]}>
            <ActivityIndicator size="small" color="#fff" />
          </View>
        ) : isRecording ? (
          <TouchableOpacity style={[styles.iconButton, { backgroundColor: colors.danger }]} onPress={stopRecording}>
            <Ionicons name="stop" size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.iconButton, { backgroundColor: colors.primary }]} onPress={startRecording}>
            <Ionicons name="mic" size={18} color="#fff" />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.sendButton, { backgroundColor: colors.primary }]} onPress={sendMessage}>
          <Text style={styles.sendText}>
            {editingMessage ? 'Save' : 'Send'}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal visible={menuVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={[styles.menuContainer, { backgroundColor: colors.surface }]}>
            <TouchableOpacity style={styles.menuItem} onPress={handleEdit}>
              <Text style={[styles.menuItemText, { color: colors.text }]}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
              <Text style={[styles.menuItemText, { color: colors.danger }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
  },
  headerInfo: {},
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  headerAvatarPlaceholder: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  headerAvatarText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  onlineStatus: { fontSize: 12, fontWeight: '600' },
  disconnected: { color: '#ffcc00', fontSize: 12 },
  typingText: { fontSize: 12, fontStyle: 'italic' },
  e2eeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  e2eeLabel: { fontSize: 11, fontWeight: '600' },
  callActions: { flexDirection: 'row', gap: 12, marginLeft: 8 },
  callBtn: { padding: 6 },
  messagesList: { flex: 1 },
  messagesContent: { paddingHorizontal: 10, paddingVertical: 8 },
  messageRow: { flexDirection: 'row', marginBottom: 6 },
  myMessageRow: { justifyContent: 'flex-end' },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deletedBubble: { opacity: 0.7 },
  deletedText: { fontSize: 14, fontStyle: 'italic' },
  senderName: { fontSize: 12, fontWeight: 'bold', marginBottom: 2 },
  messageText: { fontSize: 15 },
  messageImage: { width: 200, height: 200, borderRadius: 8, marginVertical: 4 },
  voiceBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    minWidth: 120,
  },
  voiceText: { fontSize: 14, marginLeft: 8 },
  messageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  edited: { fontSize: 11, fontStyle: 'italic', marginRight: 2 },
  time: { fontSize: 11 },
  status: { fontSize: 11, marginLeft: 4 },
  loadingMore: { paddingVertical: 10, alignItems: 'center' },
  emptyMessages: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: 14 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderTopWidth: 0.5,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  iconButton: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    marginLeft: 6,
  },
  sendButton: {
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginLeft: 6,
  },
  sendText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  cancelEdit: { paddingRight: 8 },
  cancelEditText: { fontWeight: '600', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  menuContainer: { borderRadius: 12, padding: 8, minWidth: 160 },
  menuItem: { paddingVertical: 14, paddingHorizontal: 20 },
  menuItemText: { fontSize: 16 },
});
