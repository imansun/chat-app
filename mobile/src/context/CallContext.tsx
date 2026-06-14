import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Alert, Platform } from 'react-native';
import { connectCallSocket, getCallSocket } from '../services/socket';
import { useAuth } from './AuthContext';
import { Socket } from 'socket.io-client';

function requireWebRTC() {
  if (Platform.OS === 'web') return null;
  try {
    return require('react-native-webrtc');
  } catch {
    return null;
  }
}

interface CallUser {
  id: number;
  username: string;
  avatar: string | null;
}

export interface CallState {
  callId: number | null;
  status: 'idle' | 'ringing' | 'connecting' | 'active' | 'ended';
  type: 'audio' | 'video';
  remoteUser: CallUser | null;
  isCaller: boolean;
  duration: number;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

interface CallContextType {
  call: CallState;
  startCall: (targetUser: CallUser, type: 'audio' | 'video') => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  toggleVideo: () => void;
  isMuted: boolean;
  isSpeakerOn: boolean;
  isVideoOn: boolean;
  localStream: any | null;
}

const CallContext = createContext<CallContextType>({} as CallContextType);

export const useCall = () => useContext(CallContext);

export const CallProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [call, setCall] = useState<CallState>({
    callId: null,
    status: 'idle',
    type: 'audio',
    remoteUser: null,
    isCaller: false,
    duration: 0,
  });
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [localStream, setLocalStream] = useState<any | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    initCallSocket();
    return () => {
      cleanupCall();
    };
  }, []);

  const initCallSocket = async () => {
    const socket = await connectCallSocket();
    if (!socket) return;

    socket.on('call:incoming', (data: { callId: number; caller: CallUser; type: 'audio' | 'video' }) => {
      setCall({
        callId: data.callId,
        status: 'ringing',
        type: data.type,
        remoteUser: data.caller,
        isCaller: false,
        duration: 0,
      });
    });

    socket.on('call:accepted', async (data: { callId: number }) => {
      setCall((prev) => ({ ...prev, status: 'connecting' }));
    });

    socket.on('call:rejected', (data: { callId: number }) => {
      setCall((prev) => ({ ...prev, status: 'idle' }));
      Alert.alert('Call Rejected', 'The user declined the call');
      cleanupPeerConnection();
    });

    socket.on('call:ended', (data: { callId: number }) => {
      setCall((prev) => ({ ...prev, status: 'ended' }));
      setTimeout(() => setCall((prev) => ({ ...prev, status: 'idle', callId: null, remoteUser: null })), 1000);
      cleanupPeerConnection();
    });

    socket.on('call:busy', () => {
      Alert.alert('Busy', 'User is on another call');
      setCall((prev) => ({ ...prev, status: 'idle' }));
    });

    socket.on('call:offer', async (data: { callId: number; sdp: string }) => {
      await handleRemoteOffer(data.callId, data.sdp);
    });

    socket.on('call:answer', async (data: { callId: number; sdp: string }) => {
      await handleRemoteAnswer(data.sdp);
    });

    socket.on('call:ice-candidate', async (data: { callId: number; candidate: string }) => {
      await handleRemoteIceCandidate(data.candidate);
    });
  };

  const createPeerConnection = async () => {
    const webrtc = requireWebRTC();
    if (!webrtc) return null;
    const { RTCPeerConnection: RTC } = webrtc;
    const pc = new RTC(ICE_SERVERS);
    pcRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const socket = getCallSocket();
        socket?.emit('call:ice-candidate', {
          callId: call.callId,
          candidate: JSON.stringify(event.candidate),
        });
      }
    };

    pc.ontrack = (event) => {
      remoteStreamRef.current = event.streams[0];
      setCall((prev) => ({ ...prev, status: 'active' }));
    };

    const webrtc = requireWebRTC();
    if (!webrtc) return null;

    const stream = await webrtc.mediaDevices.getUserMedia({
      audio: true,
      video: call.type === 'video',
    });
    setLocalStream(stream);

    stream.getTracks().forEach((track) => {
      if (pc.signalingState !== 'closed') {
        pc.addTrack(track, stream);
      }
    });

    return pc;
  };

  const handleRemoteOffer = async (callId: number, sdpString: string) => {
    const webrtc = requireWebRTC();
    if (!webrtc) return;
    try {
      const pc = await createPeerConnection();
      if (!pc) return;
      await pc.setRemoteDescription(new webrtc.RTCSessionDescription(JSON.parse(sdpString)));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const socket = getCallSocket();
      socket?.emit('call:answer', { callId, sdp: JSON.stringify(answer) });
    } catch {}
  };

  const handleRemoteAnswer = async (sdpString: string) => {
    const webrtc = requireWebRTC();
    if (!webrtc) return;
    try {
      if (!pcRef.current) return;
      await pcRef.current.setRemoteDescription(
        new webrtc.RTCSessionDescription(JSON.parse(sdpString)),
      );
    } catch {}
  };

  const handleRemoteIceCandidate = async (candidateString: string) => {
    const webrtc = requireWebRTC();
    if (!webrtc) return;
    try {
      if (!pcRef.current) return;
      await pcRef.current.addIceCandidate(new webrtc.RTCIceCandidate(JSON.parse(candidateString)));
    } catch {}
  };

  const startCall = async (targetUser: CallUser, type: 'audio' | 'video') => {
    setCall({
      callId: null,
      status: 'connecting',
      type,
      remoteUser: targetUser,
      isCaller: true,
      duration: 0,
    });

    const socket = getCallSocket();
    socket?.emit('call:start', { targetUserId: targetUser.id, type });

    socket?.once('call:initiated', async (data: { callId: number }) => {
      setCall((prev) => ({ ...prev, callId: data.callId }));
      try {
        const pc = await createPeerConnection();
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket?.emit('call:offer', { callId: data.callId, sdp: JSON.stringify(offer) });

        startDurationTimer(data.callId);
      } catch {}
    });
  };

  const acceptCall = async () => {
    if (!call.callId) return;
    const socket = getCallSocket();
    socket?.emit('call:accept', { callId: call.callId });
    startDurationTimer(call.callId);
  };

  const rejectCall = () => {
    if (!call.callId) return;
    const socket = getCallSocket();
    socket?.emit('call:reject', { callId: call.callId });
    setCall((prev) => ({ ...prev, status: 'idle', callId: null, remoteUser: null }));
  };

  const endCall = () => {
    if (!call.callId) return;
    const socket = getCallSocket();
    socket?.emit('call:end', { callId: call.callId });

    if (call.status === 'ringing' && !call.isCaller) {
      socket?.emit('call:missed', { callId: call.callId });
    }

    cleanupPeerConnection();
    setCall((prev) => ({ ...prev, status: 'idle', callId: null, remoteUser: null }));
  };

  const cleanupCall = () => {
    cleanupPeerConnection();
    if (durationRef.current) {
      clearInterval(durationRef.current);
      durationRef.current = null;
    }
  };

  const cleanupPeerConnection = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
    }
    remoteStreamRef.current = null;
    if (durationRef.current) {
      clearInterval(durationRef.current);
      durationRef.current = null;
    }
  };

  const startDurationTimer = (callId: number) => {
    if (durationRef.current) clearInterval(durationRef.current);
    durationRef.current = setInterval(() => {
      setCall((prev) => prev.duration + 1);
    }, 1000);
  };

  const toggleMute = () => {
    setIsMuted((prev) => {
      localStream?.getAudioTracks().forEach((t) => { t.enabled = prev; });
      return !prev;
    });
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn((prev) => !prev);
  };

  const toggleVideo = () => {
    setIsVideoOn((prev) => {
      localStream?.getVideoTracks().forEach((t) => { t.enabled = !prev; });
      return !prev;
    });
  };

  return (
    <CallContext.Provider
      value={{
        call,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleSpeaker,
        toggleVideo,
        isMuted,
        isSpeakerOn,
        isVideoOn,
        localStream,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};
