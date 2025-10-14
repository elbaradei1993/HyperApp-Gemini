import React from 'react';
import { useNotification } from '../../contexts/NotificationContext';
import { ExclamationTriangleIcon, LightBulbIcon } from './Icons';

const Toast: React.FC = () => {
  const { notification, hideNotification } = useNotification();

  if (!notification) {
    return null;
  }
  
  const config = {
      info: {
          icon: <LightBulbIcon className="w-6 h-6" />,
          style: 'bg-brand-accent/95 text-brand-primary'
      },
      warning: {
          icon: <ExclamationTriangleIcon className="w-6 h-6" />,
          style: 'bg-orange-500/95 text-white'
      },
      error: {
          icon: <ExclamationTriangleIcon className="w-6 h-6" />,
          style: 'bg-brand-danger/95 text-white'
      }
  }

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-md px-4 pointer-events-none">
      <div
        className={`flex items-center p-3 rounded-lg shadow-2xl animate-fade-in-down pointer-events-auto ${config[notification.type].style}`}
        role="alert"
      >
        <div className="flex-shrink-0">{config[notification.type].icon}</div>
        <p className="flex-grow text-sm font-semibold px-3">{notification.message}</p>
        <button onClick={hideNotification} className="font-bold text-xl leading-none opacity-70 hover:opacity-100">&times;</button>
      </div>
    </div>
  );
};

export default Toast;
