import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import '../styles/Users.css';

interface User {
  id: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  createdAt?: string;
  [key: string]: any;
}

const Users: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const currentUserId = auth.currentUser?.uid;
        const usersCollection = collection(db, 'users');
        const usersSnapshot = await getDocs(usersCollection);
        const usersList: User[] = usersSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })).filter((user) => user.id !== currentUserId);
        setUsers(usersList);
        setError(null);
      } catch (err) {
        console.error('Error fetching users:', err);
        setError('Failed to load users. Please try again.');
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleUserClick = (userId: string) => {
    navigate(`/chat/${userId}`);
  };

  return (
    <div className="users-container">
      <div className="users-header">
        <h1>All Users</h1>
        <p className="users-count">{users.length} users found</p>
      </div>

      {loading && (
        <div className="users-loading">
          <p>Loading users...</p>
        </div>
      )}

      {error && (
        <div className="users-error">
          <p>{error}</p>
        </div>
      )}

      {!loading && users.length === 0 && !error && (
        <div className="users-empty">
          <p>No users found</p>
        </div>
      )}

      {!loading && users.length > 0 && (
        <div className="users-grid">
          {users.map((user) => (
            <div
              key={user.id}
              className="user-card"
              onClick={() => handleUserClick(user.id)}
            >
              {user.photoURL && (
                <img src={user.photoURL} alt={user.displayName || 'User'} className="user-avatar" />
              )}
              {!user.photoURL && (
                <div className="user-avatar-placeholder">
                  {(user.displayName || user.email || 'User')[0]?.toUpperCase()}
                </div>
              )}
              <div className="user-info">
                <h3 className="user-name">{user.displayName || 'Anonymous'}</h3>
                <p className="user-email">{user.email || 'No email'}</p>
                {user.createdAt && (
                  <p className="user-date">
                    Joined: {new Date(user.createdAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Users;
