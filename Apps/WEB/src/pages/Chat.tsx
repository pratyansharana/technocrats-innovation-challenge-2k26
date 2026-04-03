import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth } from '../config/firebase';
import '../styles/Chat.css';

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName?: string;
  timestamp: Timestamp | Date;
}

interface ChatUser {
  id: string;
  displayName?: string;
  email?: string;
  photoURL?: string;
}

const Chat: React.FC = () => {
  const { userId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatUser, setChatUser] = useState<ChatUser | null>(null);
  const [fetchingUser, setFetchingUser] = useState(!!userId);

  // Generate a consistent conversation ID based on two user IDs
  const getConversationId = (user1Id: string, user2Id: string) => {
    return [user1Id, user2Id].sort().join('_');
  };

  const conversationId = currentUser && userId ? getConversationId(currentUser.uid, userId) : null;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthResolved(true);
    });

    return () => unsubscribe();
  }, []);

  // Fetch the chat user and set up real-time listener
  useEffect(() => {
    if (!userId) return;

    const fetchChatUser = async () => {
      try {
        setFetchingUser(true);
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setChatUser({
            id: userSnap.id,
            ...userSnap.data() as any,
          });
        } else {
          setChatUser(null);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
        setChatUser(null);
      } finally {
        setFetchingUser(false);
      }
    };

    fetchChatUser();
  }, [userId]);

  // Set up real-time listener for messages
  useEffect(() => {
    if (!conversationId || !currentUser) return;

    try {
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      const q = query(messagesRef, orderBy('timestamp', 'asc'));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedMessages: Message[] = [];
        snapshot.forEach((doc) => {
          fetchedMessages.push({
            id: doc.id,
            ...doc.data() as any,
          });
        });
        setMessages(fetchedMessages);
        setChatError(null);
      }, (error) => {
        console.error('Realtime listener error:', error);
        setChatError('Unable to load messages. Check Firestore rules and authentication.');
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Error setting up message listener:', error);
    }
  }, [conversationId, currentUser]);

  const handleSendMessage = async () => {
    if (!input.trim() || !conversationId || !currentUser) return;

    setLoading(true);
    try {
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      await addDoc(messagesRef, {
        text: input,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || 'Anonymous',
        timestamp: Timestamp.now(),
      });
      setInput('');
      setChatError(null);
    } catch (error) {
      console.error('Error sending message:', error);
      setChatError('Failed to send message. Check Firestore rules and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackClick = () => {
    navigate('/users');
  };

  if (!authResolved) {
    return (
      <div className="chat-container">
        <div className="chat-header">
          <p style={{ color: '#ffffff' }}>Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="chat-container">
        <div className="chat-header">
          <p style={{ color: '#ffffff' }}>Please login again to continue chatting.</p>
        </div>
      </div>
    );
  }

  if (fetchingUser) {
    return (
      <div className="chat-container">
        <div className="chat-header">
          <p style={{ color: '#ffffff' }}>Loading user...</p>
        </div>
      </div>
    );
  }

  if (userId && !chatUser) {
    return (
      <div className="chat-container">
        <div className="chat-header">
          <p style={{ color: '#ffffff' }}>User not found</p>
        </div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="chat-container">
        <div className="chat-header">
          <p style={{ color: '#ffffff' }}>Open chat from the Users page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <button className="back-button" onClick={handleBackClick}>←</button>
        <div className="chat-user-info">
          {chatUser?.photoURL && (
            <img src={chatUser.photoURL} alt={chatUser.displayName} className="chat-user-avatar" />
          )}
          {!chatUser?.photoURL && (
            <div className="chat-user-avatar-placeholder">
              {(chatUser?.displayName || chatUser?.email || 'User')[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <h1>{chatUser?.displayName || 'Anonymous'}</h1>
            <p className="chat-user-email">{chatUser?.email || ''}</p>
          </div>
        </div>
      </div>

      <div className="chat-messages">
        {chatError && (
          <div className="chat-empty">
            <p>{chatError}</p>
          </div>
        )}
        {!chatError && messages.length === 0 ? (
          <div className="chat-empty">
            <p>Start a conversation</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`chat-message ${msg.senderId === currentUser?.uid ? 'user' : 'bot'}`}
            >
              <div className="message-content">{msg.text}</div>
              <div className="message-time">
                {msg.timestamp instanceof Timestamp
                  ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : msg.timestamp instanceof Date
                    ? msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : ''
                }
              </div>
            </div>
          ))
        )}
      </div>

      <div className="chat-input-container">
        <input
          type="text"
          className="chat-input"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          disabled={loading}
        />
        <button
          className="chat-send-btn"
          onClick={handleSendMessage}
          disabled={loading || !input.trim()}
        >
          {loading ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
};

export default Chat;
