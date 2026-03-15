"use client";

import React, { useState, useEffect } from "react";
import { notificationManager } from "@/lib/notifications";
import { 
  Users, 
  Eye, 
  Edit3, 
  MousePointer, 
  Circle, 
  User, 
  Wifi, 
  WifiOff,
  MoreVertical
} from "lucide-react";

interface PresenceUser {
  id: string;
  name: string;
  avatar?: string;
  status: 'online' | 'away' | 'offline' | 'busy';
  activity: 'viewing' | 'editing' | 'idle';
  lastSeen: Date;
  location?: {
    page: string;
    section?: string;
  };
  cursor?: {
    line: number;
    column: number;
    selection?: {
      start: { line: number; column: number };
      end: { line: number; column: number };
    };
  };
  permissions: {
    canEdit: boolean;
    canView: boolean;
    canComment: boolean;
  };
}

interface PresenceIndicatorProps {
  resourceId: string;
  resourceType: string;
  showDetails?: boolean;
  maxVisible?: number;
  className?: string;
}

export function PresenceIndicator({ 
  resourceId, 
  resourceType, 
  showDetails = false, 
  maxVisible = 3,
  className = "" 
}: PresenceIndicatorProps) {
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    // Simulate presence data (in real app, this would come from WebSocket)
    const mockUsers: PresenceUser[] = [
      {
        id: '1',
        name: 'John Doe',
        avatar: '/avatars/john.jpg',
        status: 'online',
        activity: 'editing',
        lastSeen: new Date(),
        location: { page: '/projects/project-123', section: 'overview' },
        cursor: { line: 15, column: 25 },
        permissions: { canEdit: true, canView: true, canComment: true }
      },
      {
        id: '2',
        name: 'Jane Smith',
        avatar: '/avatars/jane.jpg',
        status: 'online',
        activity: 'viewing',
        lastSeen: new Date(),
        location: { page: '/projects/project-123', section: 'tasks' },
        permissions: { canEdit: false, canView: true, canComment: true }
      },
      {
        id: '3',
        name: 'Bob Johnson',
        status: 'away',
        activity: 'idle',
        lastSeen: new Date(Date.now() - 300000),
        location: { page: '/projects/project-123', section: 'timeline' },
        permissions: { canEdit: true, canView: true, canComment: true }
      },
      {
        id: '4',
        name: 'Alice Brown',
        status: 'offline',
        activity: 'idle',
        lastSeen: new Date(Date.now() - 3600000),
        permissions: { canEdit: false, canView: true, canComment: false }
      }
    ];
    setUsers(mockUsers);

    // Simulate connection status
    const connectionInterval = setInterval(() => {
      setIsConnected(Math.random() > 0.1); // 90% uptime simulation
    }, 5000);

    return () => clearInterval(connectionInterval);
  }, [resourceId, resourceType]);

  const onlineUsers = users.filter(user => user.status !== 'offline');
  const editingUsers = users.filter(user => user.activity === 'editing');
  const visibleUsers = showDetails ? users : onlineUsers.slice(0, maxVisible);
  const additionalCount = onlineUsers.length - maxVisible;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'busy': return 'bg-red-500';
      case 'offline': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  const getActivityIcon = (activity: string) => {
    switch (activity) {
      case 'editing': return <Edit3 className="w-3 h-3" />;
      case 'viewing': return <Eye className="w-3 h-3" />;
      case 'idle': return <MousePointer className="w-3 h-3" />;
      default: return <Circle className="w-3 h-3" />;
    }
  };

  const formatLastSeen = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  const UserAvatar = ({ user, size = 'small' }: { user: PresenceUser; size?: 'small' | 'medium' | 'large' }) => {
    const sizeClasses = {
      small: 'w-6 h-6',
      medium: 'w-8 h-8',
      large: 'w-10 h-10'
    };

    return (
      <div className="relative">
        <img
          src={user.avatar || '/avatars/default.jpg'}
          alt={user.name}
          className={`${sizeClasses[size]} rounded-full border-2 border-white`}
        />
        <div className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-white ${getStatusColor(user.status)}`}></div>
      </div>
    );
  };

  return (
    <div className={`relative ${className}`}>
      {/* Presence Indicator */}
      <div className="flex items-center gap-2">
        {/* Connection Status */}
        <div className={`flex items-center gap-1 ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
          {isConnected ? (
            <Wifi className="w-4 h-4" />
          ) : (
            <WifiOff className="w-4 h-4" />
          )}
        </div>

        {/* User Avatars */}
        <div className="flex items-center">
          {visibleUsers.map((user, index) => (
            <div
              key={user.id}
              className={`${index > 0 ? '-ml-2' : ''} relative group`}
              title={`${user.name} - ${user.activity} ${user.status}`}
            >
              <UserAvatar user={user} size="small" />
              
              {/* Hover Tooltip */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                <div className="flex items-center gap-2">
                  <span>{user.name}</span>
                  <div className="flex items-center gap-1">
                    {getActivityIcon(user.activity)}
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(user.status)}`}></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {/* Additional Users Count */}
          {additionalCount > 0 && (
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs text-gray-600 border-2 border-white hover:bg-gray-300"
            >
              +{additionalCount}
            </button>
          )}
        </div>

        {/* Activity Summary */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          {editingUsers.length > 0 && (
            <div className="flex items-center gap-1">
              <Edit3 className="w-3 h-3 text-blue-600" />
              <span>{editingUsers.length} editing</span>
            </div>
          )}
          
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>{onlineUsers.length} online</span>
          </div>
        </div>

        {/* Expand Button */}
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="p-1 text-gray-400 hover:text-gray-600"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">Active Users</h3>
              <span className="text-sm text-gray-500">{users.length} total</span>
            </div>
            
            {/* Connection Status */}
            <div className="flex items-center gap-2 text-sm">
              {isConnected ? (
                <>
                  <Wifi className="w-4 h-4 text-green-600" />
                  <span className="text-green-600">Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-red-600" />
                  <span className="text-red-600">Disconnected</span>
                </>
              )}
            </div>
          </div>

          {/* Users List */}
          <div className="max-h-64 overflow-y-auto">
            {users.map(user => (
              <div key={user.id} className="flex items-center justify-between p-3 hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <UserAvatar user={user} size="medium" />
                  <div>
                    <div className="font-medium text-gray-900">{user.name}</div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      {getActivityIcon(user.activity)}
                      <span className="capitalize">{user.activity}</span>
                      <span>•</span>
                      <span className="capitalize">{user.status}</span>
                      {user.location && (
                        <>
                          <span>•</span>
                          <span>{user.location.page}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Permissions */}
                  <div className="flex items-center gap-1">
                    {user.permissions.canEdit && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full" title="Can edit"></div>
                    )}
                    {user.permissions.canComment && (
                      <div className="w-2 h-2 bg-green-500 rounded-full" title="Can comment"></div>
                    )}
                    {user.permissions.canView && (
                      <div className="w-2 h-2 bg-gray-400 rounded-full" title="Can view"></div>
                    )}
                  </div>

                  {/* Last Seen */}
                  {user.status !== 'online' && (
                    <span className="text-xs text-gray-500">
                      {formatLastSeen(user.lastSeen)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              Real-time presence updates
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Compact presence indicator for sidebars
export function CompactPresence({ 
  resourceId, 
  resourceType 
}: { 
  resourceId: string; 
  resourceType: string; 
}) {
  const [onlineCount, setOnlineCount] = useState(0);
  const [editingCount, setEditingCount] = useState(0);

  useEffect(() => {
    // Simulate counts
    setOnlineCount(3);
    setEditingCount(1);
  }, [resourceId, resourceType]);

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <Users className="w-4 h-4" />
      <span>{onlineCount} online</span>
      {editingCount > 0 && (
        <>
          <span>•</span>
          <Edit3 className="w-3 h-3 text-blue-600" />
          <span>{editingCount} editing</span>
        </>
      )}
    </div>
  );
}

// Cursor position indicator for collaborative editing
export function CursorIndicator({ 
  user, 
  position 
}: { 
  user: PresenceUser; 
  position: { line: number; column: number }; 
}) {
  if (user.activity !== 'editing') return null;

  return (
    <div
      className="absolute flex items-center gap-1 pointer-events-none z-10"
      style={{
        top: `${position.line * 20}px`,
        left: `${position.column * 8}px`,
      }}
    >
      <div className="flex items-center gap-1 bg-blue-500 text-white px-2 py-1 rounded text-xs">
        <div className="w-2 h-2 bg-white rounded-full"></div>
        <span>{user.name}</span>
      </div>
      <div className="w-0.5 h-4 bg-blue-500"></div>
    </div>
  );
}

// Selection indicator for collaborative selection
export function SelectionIndicator({ 
  user, 
  selection 
}: { 
  user: PresenceUser; 
  selection: { 
    start: { line: number; column: number }; 
    end: { line: number; column: number }; 
  }; 
}) {
  if (user.activity !== 'editing' || !selection) return null;

  const top = Math.min(selection.start.line, selection.end.line) * 20;
  const height = (Math.abs(selection.end.line - selection.start.line) + 1) * 20;

  return (
    <div
      className="absolute bg-blue-200 opacity-30 pointer-events-none z-5"
      style={{
        top: `${top}px`,
        left: `${Math.min(selection.start.column, selection.end.column) * 8}px`,
        width: `${Math.abs(selection.end.column - selection.start.column) * 8}px`,
        height: `${height}px`,
      }}
    />
  );
}

// Hook for using presence features
export function usePresence(resourceId: string, resourceType: string) {
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    // Simulate presence data
    const mockUsers: PresenceUser[] = [
      {
        id: '1',
        name: 'John Doe',
        status: 'online',
        activity: 'editing',
        lastSeen: new Date(),
        permissions: { canEdit: true, canView: true, canComment: true }
      }
    ];
    setUsers(mockUsers);

    const connectionInterval = setInterval(() => {
      setIsConnected(Math.random() > 0.1);
    }, 5000);

    return () => clearInterval(connectionInterval);
  }, [resourceId, resourceType]);

  const updatePresence = (activity: PresenceUser['activity'], location?: string) => {
    // In real app, this would send presence update via WebSocket
    console.log('Updating presence:', { activity, location });
  };

  const broadcastCursor = (position: { line: number; column: number }) => {
    // In real app, this would broadcast cursor position
    console.log('Broadcasting cursor:', position);
  };

  const broadcastSelection = (selection: { 
    start: { line: number; column: number }; 
    end: { line: number; column: number }; 
  }) => {
    // In real app, this would broadcast selection
    console.log('Broadcasting selection:', selection);
  };

  return {
    users,
    isConnected,
    onlineUsers: users.filter(u => u.status !== 'offline'),
    editingUsers: users.filter(u => u.activity === 'editing'),
    updatePresence,
    broadcastCursor,
    broadcastSelection,
  };
}
