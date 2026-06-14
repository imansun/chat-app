# Chat App

A full-stack real-time messaging application built with NestJS (backend) and React Native / Expo (mobile).

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | NestJS 11, TypeScript, TypeORM, MySQL |
| **Auth** | Passport.js + JWT, bcrypt |
| **Real-time** | Socket.IO (WebSocket) |
| **Mobile** | React Native 0.76, Expo ~52 |
| **Navigation** | React Navigation 7 (native-stack) |
| **HTTP Client** | Axios |
| **Storage** | expo-secure-store |

---

## Architecture

```
┌──────────────────┐
│   MySQL Database │
└──────┬───────────┘
       │ TypeORM
┌──────▼──────────────┐
│   NestJS Backend     │
│  (port 3000)         │
│                      │
│  REST API (HTTP)     │
│  ├─ POST /auth/*     │
│  ├─ POST/GET /chat/* │
│  └─ GET /users/      │
│                      │
│  WebSocket (/chat)   │
│  ├─ message:send/new │
│  ├─ message:read     │
│  ├─ typing:start/stop│
│  └─ user:online/off  │
└──────────┬───────────┘
           │
┌──────────▼──────────┐
│  React Native (Expo) │
│  Mobile App          │
│                      │
│  Screens:            │
│  ├─ LoginScreen      │
│  ├─ RegisterScreen   │
│  ├─ ChatListScreen   │
│  └─ ChatScreen       │
│                      │
│  Auth: SecureStore+JWT│
│  Real-time: Socket.IO │
└─────────────────────┘
```

---

## Project Structure

```
chat-app/
├── backend/                  # NestJS API server
│   ├── src/
│   │   ├── main.ts           # Entry point (CORS, ValidationPipe, JwtAuthGuard)
│   │   ├── app.module.ts     # Root module (TypeORM, Config, feature modules)
│   │   ├── config/           # DB & JWT environment config
│   │   ├── auth/             # Register, login, JWT strategy, guard
│   │   ├── users/            # User entity, search, online status
│   │   ├── chat/             # Rooms (private/group), messages endpoint
│   │   ├── messages/         # Message entity, CRUD, read receipts
│   │   ├── chat-gateway/     # Socket.IO gateway (real-time messaging)
│   │   └── common/           # Shared decorators, guards
│   └── .env.example
│
└── mobile/                   # React Native (Expo) app
    └── src/
        ├── context/          # AuthContext (login, register, logout, SecureStore)
        ├── navigation/       # Stack navigator (auth vs main screens)
        ├── screens/          # Login, Register, ChatList, Chat
        └── services/         # Axios API client, Socket.IO client
```

---

## Phase 1: Bug Fixes & Performance

### Fixes
- **Messages not loading** — Created `GET /chat/room/:id/messages` endpoint with pagination; ChatScreen now fetches messages via API on mount
- **Socket connected state** — Added `socket.connected` check to avoid race condition where `setSocketConnected(true)` was called unconditionally
- **Performance** — `getUserRooms` no longer JOINs all messages; instead fetches only the last message per room (separate query)

### Changes
| File | Change |
|---|---|
| `backend/src/chat/chat.service.ts` | Removed `leftJoinAndSelect('room.messages')`, added `lastMessage` query + `getRoomMessages()` |
| `backend/src/chat/chat.controller.ts` | Added `GET /chat/room/:id/messages?limit=&offset=` |
| `backend/src/chat/chat.module.ts` | Imported Message entity |
| `backend/.env.example` | Created |
| `mobile/src/services/api.ts` | Added `getRoomMessages`, `lastMessage` to Room interface |
| `mobile/src/screens/ChatScreen.tsx` | Rewrote `fetchMessages` to load from API, added `loadingMessages` state |
| `mobile/src/screens/ChatListScreen.tsx` | Uses `room.lastMessage` instead of `room.messages[0]` |

---

## Phase 2: Core Features

### Pagination (Infinite Scroll)
- FlatList with `onEndReached`, `ListFooterComponent` for loading indicator
- Tracks `offset`, `hasMore` to prevent redundant requests
- Fetches older messages as user scrolls up

### Online Status
- Green dot indicator next to avatar in ChatListScreen
- "online" label in ChatScreen header (private chats only)
- Uses `isOnline` field from participant data

### Read Receipts
- Single checkmark (✓) for sent messages
- Double checkmark (✓✓) in blue for read messages
- Auto-marks messages as read when opening a chat via `message:read` socket event
- Real-time update via socket listener

### Error Handling
- `Alert.alert` for all API failures with server error message

---

## Phase 3: Advanced Features

### Avatar Upload
- `PATCH /users/profile` endpoint with multipart file upload (multer)
- Static file serving via `/uploads/` prefix
- Mobile: tap avatar in header to upload from gallery (expo-image-picker)
- Avatar displayed in ChatScreen header and ChatListScreen room list

### Image Sharing
- `type: 'text' | 'image'` field on Message entity
- `POST /chat/upload` for image upload, stores in `uploads/messages/`
- `image:send` WebSocket event for real-time sharing
- Mobile: `+` button in input bar opens image picker
- Images rendered inline at 200x200 in message bubbles

### Message Edit & Delete
- `PATCH /chat/messages/:id` — edit within 5-minute time limit
- `DELETE /chat/messages/:id` — soft delete (marks as deleted)
- `isEdited`, `isDeleted` fields; `message:edited` / `message:deleted` socket events
- Mobile: long-press own messages for Edit/Delete modal
- "edited" label shown; deleted messages show placeholder text

### Group Management
- `PATCH /chat/room/:id` — rename group
- `POST /chat/room/:id/members` — add members
- `DELETE /chat/room/:id/members/:userId` — remove members

---

## Setup

### Backend

```bash
cd backend
cp .env.example .env    # Edit with your MySQL credentials
npm install
npm run start:dev       # http://localhost:3000
```

### Mobile

```bash
cd mobile
npm install
npx expo start          # Scan QR with Expo Go
```

> Update `API_URL` in `mobile/src/services/api.ts` and `SOCKET_URL` in `mobile/src/services/socket.ts` to your machine's local IP.

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Register new user |
| POST | `/auth/login` | Public | Login |
| PATCH | `/users/profile` | JWT | Update profile (avatar upload) |
| GET | `/users/search?q=` | JWT | Search users |
| POST | `/chat/private` | JWT | Create 1-on-1 room |
| POST | `/chat/group` | JWT | Create group room |
| GET | `/chat/rooms` | JWT | List user's rooms |
| GET | `/chat/room/:id` | JWT | Get room details |
| GET | `/chat/room/:id/messages` | JWT | Get room messages (paginated) |
| PATCH | `/chat/room/:id` | JWT | Rename group |
| POST | `/chat/room/:id/members` | JWT | Add group members |
| DELETE | `/chat/room/:id/members/:userId` | JWT | Remove group member |
| PATCH | `/chat/messages/:id` | JWT | Edit message (5 min limit) |
| DELETE | `/chat/messages/:id` | JWT | Delete message (soft) |
| POST | `/chat/upload` | JWT | Upload image message |

---

## WebSocket Events (`/chat` namespace)

| Event | Direction | Description |
|---|---|---|---|
| `message:send` | Client → Server | Send a message |
| `message:new` | Server → Client | New message broadcast |
| `message:edit` | Client → Server | Edit a message |
| `message:edited` | Server → Client | Message edited notification |
| `message:delete` | Client → Server | Delete a message |
| `message:deleted` | Server → Client | Message deleted notification |
| `message:read` | Both | Mark/notify message read |
| `image:send` | Client → Server | Send an image message |
| `room:join` | Client → Server | Join a room |
| `room:leave` | Client → Server | Leave a room |
| `typing:start` | Both | Typing indicator on |
| `typing:stop` | Both | Typing indicator off |
| `user:online` | Server → Client | User came online |
| `user:offline` | Server → Client | User went offline |

---

## Development Roadmap

| Phase | Status | Features |
|---|---|---|
| 1 | ✅ Done | Bug fixes: messages loading, socket state, perf (JOIN) |
| 2 | ✅ Done | Pagination, online status, read receipts, error handling |
| 3 | ✅ Done | Avatar upload, image sharing, group management, message edit/delete |
| 4 | ⬜ Pending | Production-ready: migrations, rate limiting, logging, Swagger, Docker |
| 5 | ⬜ Pending | Voice/video calls, stories, E2E encryption, dark mode |
