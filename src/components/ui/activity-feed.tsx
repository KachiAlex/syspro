"use client";

import React, { useState, useEffect } from "react";
import { notificationManager, ActivityFeedItem } from "@/lib/notifications";
import { 
  Activity, 
  Plus, 
  Edit, 
  Trash2, 
  X,
  User, 
  Building, 
  CreditCard, 
  Target, 
  Users, 
  FileText, 
  MessageSquare, 
  AtSign, 
  CheckCircle, 
  Clock, 
  Filter,
  Search,
  MoreVertical,
  Eye,
  EyeOff
} from "lucide-react";

interface ActivityFeedProps {
  className?: string;
  limit?: number;
  showFilters?: boolean;
  showSearch?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function ActivityFeed({ 
  className = "", 
  limit = 20,
  showFilters = true,
  showSearch = true,
  autoRefresh = true,
  refreshInterval = 30000
}: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityFeedItem[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<ActivityFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [showHidden, setShowHidden] = useState(false);
  const [hiddenActivities, setHiddenActivities] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Subscribe to activity updates
    const unsubscribe = notificationManager.subscribeToActivity(setActivities);
    
    // Load initial activities
    const initialActivities = notificationManager.getActivityFeed({ limit });
    setActivities(initialActivities);
    setFilteredActivities(initialActivities);
    setLoading(false);

    return unsubscribe;
  }, [limit]);

  useEffect(() => {
    // Auto-refresh
    if (autoRefresh) {
      const interval = setInterval(() => {
        const refreshedActivities = notificationManager.getActivityFeed({ limit });
        setActivities(refreshedActivities);
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, limit]);

  useEffect(() => {
    // Filter activities based on search and active filter
    let filtered = activities.filter(activity => {
      const matchesSearch = searchTerm === '' || 
        activity.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.actor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.target.name.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesFilter = activeFilter === 'all' || activity.type === activeFilter;

      const notHidden = !hiddenActivities.has(activity.id);

      return matchesSearch && matchesFilter && notHidden;
    });

    setFilteredActivities(filtered);
  }, [activities, searchTerm, activeFilter, hiddenActivities]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'create': return <Plus className="w-4 h-4 text-green-600" />;
      case 'update': return <Edit className="w-4 h-4 text-blue-600" />;
      case 'delete': return <Trash2 className="w-4 h-4 text-red-600" />;
      case 'comment': return <MessageSquare className="w-4 h-4 text-purple-600" />;
      case 'mention': return <AtSign className="w-4 h-4 text-orange-600" />;
      case 'assign': return <User className="w-4 h-4 text-indigo-600" />;
      case 'complete': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'approve': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'reject': return <X className="w-4 h-4 text-red-600" />;
      default: return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const getTargetIcon = (targetType: string) => {
    switch (targetType.toLowerCase()) {
      case 'user': return <User className="w-4 h-4" />;
      case 'department': return <Building className="w-4 h-4" />;
      case 'invoice': return <FileText className="w-4 h-4" />;
      case 'payment': return <CreditCard className="w-4 h-4" />;
      case 'project': return <Target className="w-4 h-4" />;
      case 'contact': return <Users className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
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

  const hideActivity = (id: string) => {
    setHiddenActivities(prev => new Set([...prev, id]));
  };

  const unhideActivity = (id: string) => {
    setHiddenActivities(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const ActivityItem = ({ activity }: { activity: ActivityFeedItem }) => (
    <div className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
      {/* Actor Avatar */}
      <div className="flex-shrink-0">
        {activity.actor.avatar ? (
          <img
            src={activity.actor.avatar}
            alt={activity.actor.name}
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-gray-600" />
          </div>
        )}
      </div>

      {/* Activity Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {getActivityIcon(activity.type)}
          <span className="text-sm font-medium text-gray-900">
            {activity.actor.name}
          </span>
          <span className="text-sm text-gray-500">
            {activity.description}
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600">
          {getTargetIcon(activity.target.type)}
          <a
            href={activity.target.url || '#'}
            className="hover:text-blue-600 hover:underline"
          >
            {activity.target.name}
          </a>
          <span className="text-gray-400">•</span>
          <span className="text-xs text-gray-500">
            {formatTime(activity.timestamp)}
          </span>
        </div>

        {/* Mentions */}
        {activity.mentions && activity.mentions.length > 0 && (
          <div className="flex items-center gap-1 mt-2">
            <AtSign className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-500">
              Mentioned: {activity.mentions.join(', ')}
            </span>
          </div>
        )}

        {/* Visibility Badge */}
        <div className="flex items-center gap-2 mt-2">
          <span className={`text-xs px-2 py-1 rounded-full ${
            activity.visibility === 'public' ? 'bg-green-100 text-green-800' :
            activity.visibility === 'team' ? 'bg-blue-100 text-blue-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {activity.visibility}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => hideActivity(activity.id)}
          className="p-1 text-gray-400 hover:text-gray-600"
          title="Hide activity"
        >
          <EyeOff className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const activityTypes = [
    { value: 'all', label: 'All Activities' },
    { value: 'create', label: 'Created' },
    { value: 'update', label: 'Updated' },
    { value: 'delete', label: 'Deleted' },
    { value: 'comment', label: 'Comments' },
    { value: 'mention', label: 'Mentions' },
    { value: 'assign', label: 'Assignments' },
    { value: 'complete', label: 'Completed' },
    { value: 'approve', label: 'Approvals' },
    { value: 'reject', label: 'Rejections' },
  ];

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Activity Feed</h3>
          {loading && (
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hiddenActivities.size > 0 && (
            <button
              onClick={() => setShowHidden(!showHidden)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {showHidden ? 'Hide' : 'Show'} Hidden ({hiddenActivities.size})
            </button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      {(showSearch || showFilters) && (
        <div className="p-4 border-b border-gray-200 space-y-3">
          {showSearch && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search activities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {showFilters && (
            <div className="flex flex-wrap gap-2">
              {activityTypes.map(type => (
                <button
                  key={type.value}
                  onClick={() => setActiveFilter(type.value)}
                  className={`px-3 py-1 text-xs rounded-full ${
                    activeFilter === type.value
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Activities List */}
      <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
        {filteredActivities.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Activity className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">No activities found</p>
            {searchTerm && (
              <p className="text-xs text-gray-400 mt-1">
                Try adjusting your search or filters
              </p>
            )}
          </div>
        ) : (
          <>
            {filteredActivities.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}

            {showHidden && Array.from(hiddenActivities).map(id => {
              const hiddenActivity = activities.find(a => a.id === id);
              if (!hiddenActivity) return null;
              
              return (
                <div key={id} className="flex items-center gap-3 p-3 bg-gray-50 opacity-60">
                  <div className="flex-1">
                    <div className="text-sm text-gray-500 line-through">
                      {hiddenActivity.description}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Hidden activity
                    </div>
                  </div>
                  <button
                    onClick={() => unhideActivity(id)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="Unhide activity"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Footer */}
      {activities.length > limit && (
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={() => {
              // Load more activities
              const moreActivities = notificationManager.getActivityFeed({ limit: limit * 2 });
              setActivities(moreActivities);
            }}
            className="w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Load more activities
          </button>
        </div>
      )}
    </div>
  );
}

// Hook for using activity feed
export function useActivityFeed(options?: {
  type?: string;
  visibility?: string;
  limit?: number;
  userId?: string;
}) {
  const [activities, setActivities] = useState<ActivityFeedItem[]>([]);

  useEffect(() => {
    const unsubscribe = notificationManager.subscribeToActivity(setActivities);
    
    // Load initial activities
    const initialActivities = notificationManager.getActivityFeed(options);
    setActivities(initialActivities);

    return unsubscribe;
  }, [options]);

  return {
    activities,
    addActivity: notificationManager.addActivityItem,
    refresh: () => {
      const refreshedActivities = notificationManager.getActivityFeed(options);
      setActivities(refreshedActivities);
    },
  };
}

// Compact activity feed for sidebars
export function CompactActivityFeed({ limit = 5 }: { limit?: number }) {
  const { activities } = useActivityFeed({ limit });

  return (
    <div className="space-y-3">
      {activities.slice(0, limit).map((activity) => (
        <div key={activity.id} className="flex items-start gap-2">
          <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
            {activity.actor.avatar ? (
              <img
                src={activity.actor.avatar}
                alt={activity.actor.name}
                className="w-6 h-6 rounded-full"
              />
            ) : (
              <User className="w-3 h-3 text-gray-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-600">
              <span className="font-medium text-gray-900">{activity.actor.name}</span>{' '}
              {activity.description.toLowerCase()}
            </p>
            <p className="text-xs text-gray-400">
              {formatTime(activity.timestamp)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatTime(date: Date): string {
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
}
