// Real-time notification system
export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'system' | 'user' | 'collaboration';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'system' | 'crm' | 'finance' | 'hr' | 'projects' | 'security' | 'general';
  actionUrl?: string;
  actionText?: string;
  metadata?: Record<string, any>;
  expiresAt?: Date;
  createdBy?: string;
  assignedTo?: string[];
}

export interface ActivityFeedItem {
  id: string;
  type: 'create' | 'update' | 'delete' | 'comment' | 'mention' | 'assign' | 'complete' | 'approve' | 'reject';
  actor: {
    id: string;
    name: string;
    avatar?: string;
    email?: string;
  };
  target: {
    type: string;
    id: string;
    name: string;
    url?: string;
  };
  description: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  visibility: 'public' | 'team' | 'private';
  mentions?: string[];
}

export interface CollaborationEvent {
  id: string;
  type: 'edit' | 'comment' | 'mention' | 'share' | 'assign' | 'status_change';
  resource: {
    type: string;
    id: string;
    name: string;
    url?: string;
  };
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  action: string;
  details?: string;
  timestamp: Date;
  isRealTime: boolean;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  inApp: boolean;
  categories: Record<string, boolean>;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
  };
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
}

class NotificationManager {
  private static instance: NotificationManager;
  private notifications: Notification[] = [];
  private activityFeed: ActivityFeedItem[] = [];
  private collaborationEvents: CollaborationEvent[] = [];
  private listeners: ((notifications: Notification[]) => void)[] = [];
  private activityListeners: ((activities: ActivityFeedItem[]) => void)[] = [];
  private collaborationListeners: ((events: CollaborationEvent[]) => void)[] = [];
  private websocket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  // Initialize WebSocket connection for real-time updates
  initializeWebSocket(url: string): void {
    try {
      this.websocket = new WebSocket(url);

      this.websocket.onopen = () => {
        console.log('WebSocket connected for notifications');
        this.reconnectAttempts = 0;
      };

      this.websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleRealtimeMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.websocket.onclose = () => {
        console.log('WebSocket disconnected');
        this.attemptReconnect();
      };

      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        this.reconnectAttempts++;
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        // Re-initialize WebSocket connection
        this.initializeWebSocket('ws://localhost:8080/notifications');
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  private handleRealtimeMessage(data: any): void {
    switch (data.type) {
      case 'notification':
        this.addNotification(data.payload);
        break;
      case 'activity':
        this.addActivityItem(data.payload);
        break;
      case 'collaboration':
        this.addCollaborationEvent(data.payload);
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  }

  // Notification management
  addNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): string {
    const newNotification: Notification = {
      ...notification,
      id: this.generateId(),
      timestamp: new Date(),
      read: false,
    };

    this.notifications.unshift(newNotification);
    this.notifyListeners();

    // Check for expiration
    if (newNotification.expiresAt) {
      setTimeout(() => {
        this.removeNotification(newNotification.id);
      }, newNotification.expiresAt.getTime() - Date.now());
    }

    return newNotification.id;
  }

  removeNotification(id: string): void {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.notifyListeners();
  }

  markAsRead(id: string): void {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      notification.read = true;
      this.notifyListeners();
    }
  }

  markAllAsRead(): void {
    this.notifications.forEach(n => n.read = true);
    this.notifyListeners();
  }

  getNotifications(options?: {
    unread?: boolean;
    category?: string;
    priority?: string;
    limit?: number;
  }): Notification[] {
    let filtered = [...this.notifications];

    if (options?.unread) {
      filtered = filtered.filter(n => !n.read);
    }

    if (options?.category) {
      filtered = filtered.filter(n => n.category === options.category);
    }

    if (options?.priority) {
      filtered = filtered.filter(n => n.priority === options.priority);
    }

    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  getUnreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  // Activity feed management
  addActivityItem(activity: Omit<ActivityFeedItem, 'id' | 'timestamp'>): string {
    const newActivity: ActivityFeedItem = {
      ...activity,
      id: this.generateId(),
      timestamp: new Date(),
    };

    this.activityFeed.unshift(newActivity);
    this.notifyActivityListeners();

    // Remove old activities (keep last 100)
    if (this.activityFeed.length > 100) {
      this.activityFeed = this.activityFeed.slice(0, 100);
    }

    return newActivity.id;
  }

  getActivityFeed(options?: {
    type?: string;
    visibility?: string;
    limit?: number;
    userId?: string;
  }): ActivityFeedItem[] {
    let filtered = [...this.activityFeed];

    if (options?.type) {
      filtered = filtered.filter(a => a.type === options.type);
    }

    if (options?.visibility) {
      filtered = filtered.filter(a => a.visibility === options.visibility);
    }

    if (options?.userId) {
      filtered = filtered.filter(a => 
        a.actor.id === options.userId || 
        a.mentions?.includes(options.userId)
      );
    }

    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  // Collaboration events
  addCollaborationEvent(event: Omit<CollaborationEvent, 'id' | 'timestamp'>): string {
    const newEvent: CollaborationEvent = {
      ...event,
      id: this.generateId(),
      timestamp: new Date(),
    };

    this.collaborationEvents.unshift(newEvent);
    this.notifyCollaborationListeners();

    // Remove old events (keep last 50)
    if (this.collaborationEvents.length > 50) {
      this.collaborationEvents = this.collaborationEvents.slice(0, 50);
    }

    return newEvent.id;
  }

  getCollaborationEvents(options?: {
    resourceType?: string;
    resourceId?: string;
    userId?: string;
    limit?: number;
  }): CollaborationEvent[] {
    let filtered = [...this.collaborationEvents];

    if (options?.resourceType) {
      filtered = filtered.filter(e => e.resource.type === options.resourceType);
    }

    if (options?.resourceId) {
      filtered = filtered.filter(e => e.resource.id === options.resourceId);
    }

    if (options?.userId) {
      filtered = filtered.filter(e => e.user.id === options.userId);
    }

    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  // Subscription management
  subscribe(listener: (notifications: Notification[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  subscribeToActivity(listener: (activities: ActivityFeedItem[]) => void): () => void {
    this.activityListeners.push(listener);
    return () => {
      this.activityListeners = this.activityListeners.filter(l => l !== listener);
    };
  }

  subscribeToCollaboration(listener: (events: CollaborationEvent[]) => void): () => void {
    this.collaborationListeners.push(listener);
    return () => {
      this.collaborationListeners = this.collaborationListeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener([...this.notifications]));
  }

  private notifyActivityListeners(): void {
    this.activityListeners.forEach(listener => listener([...this.activityFeed]));
  }

  private notifyCollaborationListeners(): void {
    this.collaborationListeners.forEach(listener => listener([...this.collaborationEvents]));
  }

  // Utility methods
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  // Cleanup
  disconnect(): void {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    this.listeners = [];
    this.activityListeners = [];
    this.collaborationListeners = [];
  }

  // Notification preferences
  async updatePreferences(preferences: Partial<NotificationPreferences>): Promise<void> {
    // Save preferences to backend
    try {
      await fetch('/api/user/notifications/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
    }
  }

  async getPreferences(): Promise<NotificationPreferences> {
    try {
      const response = await fetch('/api/user/notifications/preferences');
      return await response.json();
    } catch (error) {
      console.error('Failed to get notification preferences:', error);
      // Return default preferences
      return {
        email: true,
        push: true,
        inApp: true,
        categories: {
          system: true,
          crm: true,
          finance: true,
          hr: true,
          projects: true,
          security: true,
          general: true,
        },
        quietHours: {
          enabled: false,
          start: '22:00',
          end: '08:00',
          timezone: 'UTC',
        },
        frequency: 'immediate',
      };
    }
  }

  // Push notification support
  async requestPushPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }

  async showPushNotification(notification: Notification): Promise<void> {
    if (Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: notification.id,
        data: notification,
      });
    }
  }
}

// Export singleton instance
export const notificationManager = NotificationManager.getInstance();

// Helper functions for creating notifications
export const createNotification = (
  type: Notification['type'],
  title: string,
  message: string,
  options?: Partial<Omit<Notification, 'id' | 'timestamp' | 'read' | 'type' | 'title' | 'message'>>
): Omit<Notification, 'id' | 'timestamp' | 'read'> => ({
  type,
  title,
  message,
  priority: options?.priority || 'medium',
  category: options?.category || 'general',
  read: false,
  ...options,
});

export const createActivityItem = (
  type: ActivityFeedItem['type'],
  actor: ActivityFeedItem['actor'],
  target: ActivityFeedItem['target'],
  description: string,
  options?: Partial<Omit<ActivityFeedItem, 'id' | 'timestamp' | 'type' | 'actor' | 'target' | 'description'>>
): Omit<ActivityFeedItem, 'id' | 'timestamp'> => ({
  type,
  actor,
  target,
  description,
  visibility: options?.visibility || 'public',
  ...options,
});

export const createCollaborationEvent = (
  type: CollaborationEvent['type'],
  resource: CollaborationEvent['resource'],
  user: CollaborationEvent['user'],
  action: string,
  options?: Partial<Omit<CollaborationEvent, 'id' | 'timestamp' | 'type' | 'resource' | 'user' | 'action'>>
): Omit<CollaborationEvent, 'id' | 'timestamp'> => ({
  type,
  resource,
  user,
  action,
  isRealTime: options?.isRealTime || true,
  ...options,
});

// Notification templates for common events
export const notificationTemplates = {
  userAssigned: (assigneeName: string, resourceName: string) => ({
    type: 'user' as const,
    title: 'New Assignment',
    message: `You have been assigned to ${resourceName}`,
    category: 'general' as const,
    priority: 'medium' as const,
  }),

  deadlineApproaching: (resourceType: string, resourceName: string, daysLeft: number) => ({
    type: 'warning' as const,
    title: 'Deadline Approaching',
    message: `${resourceType} "${resourceName}" is due in ${daysLeft} days`,
    category: 'projects' as const,
    priority: daysLeft <= 1 ? 'urgent' as const : 'high' as const,
  }),

  documentShared: (sharedBy: string, documentName: string) => ({
    type: 'collaboration' as const,
    title: 'Document Shared',
    message: `${sharedBy} shared "${documentName}" with you`,
    category: 'general' as const,
    priority: 'medium' as const,
  }),

  commentAdded: (author: string, resourceName: string) => ({
    type: 'collaboration' as const,
    title: 'New Comment',
    message: `${author} commented on ${resourceName}`,
    category: 'general' as const,
    priority: 'low' as const,
  }),

  systemUpdate: (updateName: string) => ({
    type: 'system' as const,
    title: 'System Update',
    message: `${updateName} has been updated`,
    category: 'system' as const,
    priority: 'medium' as const,
  }),
};
