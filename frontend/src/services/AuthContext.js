import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from './api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      authAPI.getMe()
        .then((response) => {
          setUser(response.data);
          if (response.data.must_change_password) {
            setMustChangePassword(true);
          }
        })
        .catch(() => {
          localStorage.removeItem('token');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const response = await authAPI.login(email, password);
    localStorage.setItem('token', response.data.access_token);
    const userResponse = await authAPI.getMe();
    setUser(userResponse.data);
    
    if (response.data.must_change_password) {
      setMustChangePassword(true);
    }
    
    return { user: userResponse.data, mustChangePassword: response.data.must_change_password };
  };

  const register = async (userData) => {
    const response = await authAPI.register(userData);
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setMustChangePassword(false);
  };

  const updateUser = async (userData) => {
    const response = await authAPI.updateMe(userData);
    setUser(response.data);
    return response.data;
  };

  const changePassword = async (currentPassword, newPassword) => {
    await authAPI.changePassword(currentPassword, newPassword);
    setMustChangePassword(false);
    const userResponse = await authAPI.getMe();
    setUser(userResponse.data);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser, mustChangePassword, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
