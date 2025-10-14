import React, { createContext, useState, useCallback, ReactNode, useContext } from 'react';

export interface NotificationMessage {
  id: number;
  message: string;
  type: 'info' | 'warning' | 'error';
}

interface NotificationContextType {
  notification: NotificationMessage | null;
  showNotification: (message: string, type?: NotificationMessage['type']) => void;
  hideNotification: () => void;
}

export const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification must be used within a NotificationProvider');
  return context;
};

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notification, setNotification] = useState<NotificationMessage | null>(null);

  const hideNotification = useCallback(() => {
    setNotification(null);
  }, []);

  const showNotification = useCallback((message: string, type: NotificationMessage['type'] = 'info') => {
    const newNotification = { id: Date.now(), message, type };
    setNotification(newNotification);
    setTimeout(() => {
      setNotification((current) => (current?.id === newNotification.id ? null : current));
    }, 5000); // Hide after 5 seconds
  }, []);

  const value = { notification, showNotification, hideNotification };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
