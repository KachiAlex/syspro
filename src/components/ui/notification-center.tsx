"use client";

import React, { useState, useEffect } from "react";
import { notificationManager, Notification, NotificationPreferences } from "@/lib/notifications";
import { useToast } from "@/components/ui/toast";
import { 
  Bell, 
  BellRing, 
  Check, 
  X, 
  Settings, 
  Archive, 
  Trash2, 
  Clock, 
  User, 
  Building, 
  CreditCard, 
  Users, 
  Target, 
  Shield, 
  FileText,
  ChevronDown,
  Filter,
  Search,
  MoreVertical
} from "lucide-react";

interface NotificationCenterProps {
  className?: string;
}

export function NotificationCenter({ className = "" }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const toast = useToast();

  useEffect(() => {
    // Subscribe to notifications
    const unsubscribe = notificationManager.subscribe(setNotifications);
    
    // Load initial notifications
    setNotifications(notificationManager.getNotifications());
    
    // Load preferences
    notificationManager.getPreferences().then(setPreferences);

    return unsubscribe;
  }, []);

  useEffect(() => {
    // Request push notification permission
    notificationManager.requestPushPermission();
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = (id: string) => {
    notificationManager.markAsRead(id);
  };

  const handleMarkAllAsRead = () => {
    notificationManager.markAllAsRead();
    toast.success("Success", "All notifications marked as read");
  };

  const handleDelete = (id: string) => {
    notificationManager.removeNotification(id);
    toast.success("Success", "Notification deleted");
  };

  const handleArchive = (id: string) => {
    notificationManager.removeNotification(id);
    toast.success("Success", "Notification archived");
  };

  const handleNotificationClick = (notification: Notification) => {
    handleMarkAsRead(notification.id);
    
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    const matchesSearch = notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         notification.message.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = activeFilter === 'all' || 
                         activeFilter === notification.category ||
                         (activeFilter === 'unread' && !notification.read) ||
                         (activeFilter === 'priority' && notification.priority === 'high');

    return matchesSearch && matchesFilter;
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'system': return <Settings className="w-4 h-4" />;
      case 'crm': return <Users className="w-4 h-4" />;
      case 'finance': return <CreditCard className="w-4 h-4" />;
      case 'hr': return <Building className="w-4 h-4" />;
      case 'projects': return <Target className="w-4 h-4" />;
      case 'security': return <Shield className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'border-red-500 bg-red-50';
      case 'high': return 'border-orange-500 bg-orange-50';
      case 'medium': return 'border-theme-accent bg-blue-50';
      case 'low': return 'border-theme-border bg-theme-muted';
      default: return 'border-theme-border bg-theme-surface';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success': return <Check className="w-4 h-4 text-green-600" />;
      case 'error': return <X className="w-4 h-4 text-red-600" />;
      case 'warning': return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'system': return <Settings className="w-4 h-4 text-theme-text-secondary" />;
      case 'user': return <User className="w-4 h-4 text-theme-accent" />;
      case 'collaboration': return <Users className="w-4 h-4 text-purple-600" />;
      default: return <Bell className="w-4 h-4 text-theme-text-secondary" />;
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const NotificationItem = ({ notification }: { notification: Notification }) => (
    <div
      className={`p-4 border-l-4 ${getPriorityColor(notification.priority)} ${
        !notification.read ? 'bg-theme-surface' : 'bg-theme-muted'
      } hover:bg-theme-muted cursor-pointer transition-colors`}
      onClick={() => handleNotificationClick(notification)}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          {getTypeIcon(notification.type)}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className={`text-sm font-medium truncate ${
              !notification.read ? 'text-theme-text-primary' : 'text-theme-text-secondary'
            }`}>
              {notification.title}
            </h4>
            <div className="flex items-center gap-2">
              {getCategoryIcon(notification.category)}
              <span className="text-xs text-theme-text-secondary">{formatTime(notification.timestamp)}</span>
            </div>
          </div>
          
          <p className={`text-sm text-theme-text-secondary mb-2 ${!notification.read ? 'font-medium' : ''}`}>
            {notification.message}
          </p>
          
          {notification.actionText && (
            <button className="text-xs text-theme-accent hover:text-blue-800 font-medium">
              {notification.actionText}
            </button>
          )}
          
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded-full ${
                notification.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                notification.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                notification.priority === 'medium' ? 'bg-blue-100 text-blue-800' :
                'bg-theme-muted text-theme-text-primary'
              }`}>
                {notification.priority}
              </span>
            </div>
            
            <div className="flex items-center gap-1">
              {!notification.read && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkAsRead(notification.id);
                  }}
                  className="p-1 text-theme-text-tertiary hover:text-theme-text-secondary"
                  title="Mark as read"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleArchive(notification.id);
                }}
                className="p-1 text-theme-text-tertiary hover:text-theme-text-secondary"
                title="Archive"
              >
                <Archive className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(notification.id);
                }}
                className="p-1 text-theme-text-tertiary hover:text-red-600"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`relative ${className}`}>
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-theme-text-secondary hover:text-theme-text-primary transition-colors"
      >
        {unreadCount > 0 ? (
          <BellRing className="w-5 h-5" />
        ) : (
          <Bell className="w-5 h-5" />
        )}
        
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        )}
        
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-theme-surface border border-theme-border rounded-lg shadow-lg z-50 max-h-96 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-theme-border">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-theme-text-primary">Notifications</h3>
              {unreadCount > 0 && (
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-sm text-theme-accent hover:text-blue-800"
                >
                  Mark all read
                </button>
              )}
              
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-1 text-theme-text-tertiary hover:text-theme-text-secondary"
              >
                <Settings className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-theme-text-tertiary hover:text-theme-text-secondary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Settings Panel */}
          {showSettings && preferences && (
            <div className="p-4 border-b border-theme-border bg-theme-muted">
              <h4 className="text-sm font-medium text-theme-text-primary mb-3">Notification Settings</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={preferences.email}
                    onChange={(e) => {
                      const newPrefs = { ...preferences, email: e.target.checked };
                      setPreferences(newPrefs);
                      notificationManager.updatePreferences(newPrefs);
                    }}
                    className="rounded border-theme-border"
                  />
                  <span className="text-sm text-theme-text-primary">Email notifications</span>
                </label>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={preferences.push}
                    onChange={(e) => {
                      const newPrefs = { ...preferences, push: e.target.checked };
                      setPreferences(newPrefs);
                      notificationManager.updatePreferences(newPrefs);
                    }}
                    className="rounded border-theme-border"
                  />
                  <span className="text-sm text-theme-text-primary">Push notifications</span>
                </label>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={preferences.inApp}
                    onChange={(e) => {
                      const newPrefs = { ...preferences, inApp: e.target.checked };
                      setPreferences(newPrefs);
                      notificationManager.updatePreferences(newPrefs);
                    }}
                    className="rounded border-theme-border"
                  />
                  <span className="text-sm text-theme-text-primary">In-app notifications</span>
                </label>
              </div>
            </div>
          )}

          {/* Search and Filters */}
          <div className="p-4 border-b border-theme-border">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-theme-text-tertiary" />
              <input
                type="text"
                placeholder="Search notifications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1 text-xs rounded-full ${
                  activeFilter === 'all' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-theme-muted text-theme-text-secondary hover:bg-theme-muted'
                }`}
              >
                All
              </button>
              
              <button
                onClick={() => setActiveFilter('unread')}
                className={`px-3 py-1 text-xs rounded-full ${
                  activeFilter === 'unread' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-theme-muted text-theme-text-secondary hover:bg-theme-muted'
                }`}
              >
                Unread
              </button>
              
              <button
                onClick={() => setActiveFilter('priority')}
                className={`px-3 py-1 text-xs rounded-full ${
                  activeFilter === 'priority' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-theme-muted text-theme-text-secondary hover:bg-theme-muted'
                }`}
              >
                Priority
              </button>
              
              {['system', 'crm', 'finance', 'hr', 'projects', 'security'].map(category => (
                <button
                  key={category}
                  onClick={() => setActiveFilter(category)}
                  className={`px-3 py-1 text-xs rounded-full capitalize ${
                    activeFilter === category 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-theme-muted text-theme-text-secondary hover:bg-theme-muted'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto max-h-64">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-theme-text-secondary">
                <Bell className="w-8 h-8 mx-auto mb-2 text-theme-text-tertiary" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-theme-border">
                {filteredNotifications.map((notification) => (
                  <NotificationItem key={notification.id} notification={notification} />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-theme-border">
            <button
              onClick={() => {
                setIsOpen(false);
                window.location.href = '/notifications';
              }}
              className="w-full text-center text-sm text-theme-accent hover:text-blue-800 font-medium"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Hook for using notification center
export function useNotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const unsubscribe = notificationManager.subscribe(setNotifications);
    setUnreadCount(notificationManager.getUnreadCount());
    
    return unsubscribe;
  }, []);

  return {
    notifications,
    unreadCount,
    markAsRead: notificationManager.markAsRead,
    markAllAsRead: notificationManager.markAllAsRead,
    addNotification: notificationManager.addNotification,
    removeNotification: notificationManager.removeNotification,
  };
}
