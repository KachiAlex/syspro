"use client";

import React, { useState, useEffect, useRef } from "react";
import { notificationManager, CollaborationEvent } from "@/lib/notifications";
import { useToast } from "@/components/ui/toast";
import { 
  Users, 
  MessageSquare, 
  Edit, 
  Eye, 
  Share2, 
  AtSign, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  User,
  Send,
  Reply,
  MoreVertical,
  Pin,
  Trash2,
  Edit3,
  Bookmark
} from "lucide-react";

interface CollaborationPanelProps {
  resourceId: string;
  resourceType: string;
  resourceName: string;
  resourceUrl?: string;
  className?: string;
}

interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  timestamp: Date;
  edited?: boolean;
  editedAt?: Date;
  replies: Comment[];
  mentions?: string[];
  isPinned?: boolean;
  resolved?: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
}

interface ActiveUser {
  id: string;
  name: string;
  avatar?: string;
  status: 'viewing' | 'editing' | 'idle';
  lastSeen: Date;
  cursor?: {
    line: number;
    column: number;
  };
}

export function CollaborationPanel({ 
  resourceId, 
  resourceType, 
  resourceName, 
  resourceUrl,
  className = "" 
}: CollaborationPanelProps) {
  const [events, setEvents] = useState<CollaborationEvent[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showUsers, setShowUsers] = useState(false);
  const [showComments, setShowComments] = useState(true);
  const commentsRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  useEffect(() => {
    // Subscribe to collaboration events
    const unsubscribe = notificationManager.subscribeToCollaboration(setEvents);
    
    // Load initial events
    const initialEvents = notificationManager.getCollaborationEvents({
      resourceType,
      resourceId,
      limit: 20
    });
    setEvents(initialEvents);

    // Simulate active users (in real app, this would come from WebSocket)
    const mockUsers: ActiveUser[] = [
      {
        id: '1',
        name: 'John Doe',
        avatar: '/avatars/john.jpg',
        status: 'editing',
        lastSeen: new Date(),
        cursor: { line: 15, column: 25 }
      },
      {
        id: '2',
        name: 'Jane Smith',
        avatar: '/avatars/jane.jpg',
        status: 'viewing',
        lastSeen: new Date(Date.now() - 30000)
      }
    ];
    setActiveUsers(mockUsers);

    // Load mock comments
    const mockComments: Comment[] = [
      {
        id: '1',
        userId: '1',
        userName: 'John Doe',
        userAvatar: '/avatars/john.jpg',
        content: 'This looks great! I think we should add more details to the requirements section.',
        timestamp: new Date(Date.now() - 3600000),
        replies: [
          {
            id: '1-1',
            userId: '2',
            userName: 'Jane Smith',
            userAvatar: '/avatars/jane.jpg',
            content: 'I agree. Let me add those details.',
            timestamp: new Date(Date.now() - 1800000),
            replies: []
          }
        ]
      },
      {
        id: '2',
        userId: '3',
        userName: 'Bob Johnson',
        content: 'Can we review the budget estimates? They seem a bit high.',
        timestamp: new Date(Date.now() - 7200000),
        isPinned: true,
        replies: []
      }
    ];
    setComments(mockComments);

    return unsubscribe;
  }, [resourceId, resourceType]);

  useEffect(() => {
    // Scroll to bottom when new comments are added
    if (commentsRef.current) {
      commentsRef.current.scrollTop = commentsRef.current.scrollHeight;
    }
  }, [comments]);

  const handleAddComment = () => {
    if (!newComment.trim()) return;

    const comment: Comment = {
      id: Date.now().toString(),
      userId: 'current-user',
      userName: 'Current User',
      content: newComment.trim(),
      timestamp: new Date(),
      replies: [],
      mentions: extractMentions(newComment)
    };

    if (replyingTo) {
      // Add as reply
      setComments(prev => prev.map(c => {
        if (c.id === replyingTo) {
          return { ...c, replies: [...c.replies, comment] };
        }
        return c;
      }));
    } else {
      // Add as top-level comment
      setComments(prev => [comment, ...prev]);
    }

    // Create collaboration event
    notificationManager.addCollaborationEvent({
      type: 'comment',
      resource: { type: resourceType, id: resourceId, name: resourceName, url: resourceUrl },
      user: { id: 'current-user', name: 'Current User' },
      action: `commented on ${resourceName}`,
      details: newComment.trim(),
      isRealTime: true
    });

    setNewComment('');
    setReplyingTo(null);
    toast.success('Success', 'Comment added');
  };

  const handleEditComment = (commentId: string) => {
    const comment = findComment(commentId);
    if (comment) {
      setEditingComment(commentId);
      setEditContent(comment.content);
    }
  };

  const handleSaveEdit = (commentId: string) => {
    if (!editContent.trim()) return;

    updateComment(commentId, {
      content: editContent.trim(),
      edited: true,
      editedAt: new Date()
    });

    setEditingComment(null);
    setEditContent('');
    toast.success('Success', 'Comment updated');
  };

  const handleDeleteComment = (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    const removeComment = (comments: Comment[]): Comment[] => {
      return comments.filter(c => {
        if (c.id === commentId) return false;
        c.replies = removeComment(c.replies);
        return true;
      });
    };

    setComments(prev => removeComment(prev));
    toast.success('Success', 'Comment deleted');
  };

  const handleResolveComment = (commentId: string) => {
    updateComment(commentId, {
      resolved: true,
      resolvedBy: 'current-user',
      resolvedAt: new Date()
    });
    toast.success('Success', 'Comment resolved');
  };

  const handlePinComment = (commentId: string) => {
    updateComment(commentId, {
      isPinned: true
    });
    toast.success('Success', 'Comment pinned');
  };

  const findComment = (commentId: string): Comment | null => {
    for (const comment of comments) {
      if (comment.id === commentId) return comment;
      const found = comment.replies.find(r => r.id === commentId);
      if (found) return found;
    }
    return null;
  };

  const updateComment = (commentId: string, updates: Partial<Comment>) => {
    const updateRecursive = (comments: Comment[]): Comment[] => {
      return comments.map(c => {
        if (c.id === commentId) {
          return { ...c, ...updates };
        }
        c.replies = updateRecursive(c.replies);
        return c;
      });
    };

    setComments(prev => updateRecursive(prev));
  };

  const extractMentions = (text: string): string[] => {
    const mentions = text.match(/@(\w+)/g);
    return mentions ? mentions.map(m => m.substring(1)) : [];
  };

  const formatTime = (date: Date): string => {
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'editing': return 'bg-green-500';
      case 'viewing': return 'bg-blue-500';
      case 'idle': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  const CommentItem = ({ 
    comment, 
    isReply = false, 
    parentCommentId 
  }: { 
    comment: Comment; 
    isReply?: boolean; 
    parentCommentId?: string; 
  }) => (
    <div className={`${isReply ? 'ml-8 border-l-2 border-gray-200 pl-4' : ''}`}>
      <div className="flex items-start gap-3">
        {/* User Avatar */}
        <div className="flex-shrink-0">
          {comment.userAvatar ? (
            <img
              src={comment.userAvatar}
              alt={comment.userName}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-gray-600" />
            </div>
          )}
        </div>

        {/* Comment Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{comment.userName}</span>
              {comment.isPinned && <Pin className="w-3 h-3 text-yellow-500" />}
              {comment.resolved && <CheckCircle className="w-3 h-3 text-green-500" />}
              {comment.edited && <Edit3 className="w-3 h-3 text-gray-400" />}
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{formatTime(comment.timestamp)}</span>
              
              <div className="flex items-center gap-1">
                {!isReply && (
                  <button
                    onClick={() => setReplyingTo(comment.id)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="Reply"
                  >
                    <Reply className="w-3 h-3" />
                  </button>
                )}
                
                <button
                  onClick={() => handleEditComment(comment.id)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  title="Edit"
                >
                  <Edit className="w-3 h-3" />
                </button>
                
                <button
                  onClick={() => handlePinComment(comment.id)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  title="Pin"
                >
                  <Bookmark className="w-3 h-3" />
                </button>
                
                <button
                  onClick={() => handleResolveComment(comment.id)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  title="Resolve"
                >
                  <CheckCircle className="w-3 h-3" />
                </button>
                
                <button
                  onClick={() => handleDeleteComment(comment.id)}
                  className="p-1 text-gray-400 hover:text-red-600"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Comment Text */}
          {editingComment === comment.id ? (
            <div className="mb-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => handleSaveEdit(comment.id)}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditingComment(null);
                    setEditContent('');
                  }}
                  className="px-3 py-1 border border-gray-300 text-sm rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-2">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.content}</p>
              {comment.mentions && comment.mentions.length > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  <AtSign className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-500">
                    Mentioned: {comment.mentions.join(', ')}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Reply Input */}
          {replyingTo === comment.id && (
            <div className="mt-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a reply..."
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleAddComment}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  Reply
                </button>
                <button
                  onClick={() => {
                    setReplyingTo(null);
                    setNewComment('');
                  }}
                  className="px-3 py-1 border border-gray-300 text-sm rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Replies */}
          {comment.replies.length > 0 && (
            <div className="mt-3 space-y-3">
              {comment.replies.map(reply => (
                <CommentItem 
                  key={reply.id} 
                  comment={reply} 
                  isReply={true} 
                  parentCommentId={comment.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className={`bg-white border border-gray-200 rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Collaboration</h3>
          <div className="flex items-center gap-1">
            {activeUsers.slice(0, 3).map(user => (
              <div key={user.id} className="relative">
                <img
                  src={user.avatar || '/avatars/default.jpg'}
                  alt={user.name}
                  className="w-6 h-6 rounded-full border-2 border-white"
                />
                <div className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-white ${getStatusColor(user.status)}`} />
              </div>
            ))}
            {activeUsers.length > 3 && (
              <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs text-gray-600 border-2 border-white">
                +{activeUsers.length - 3}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUsers(!showUsers)}
            className={`px-3 py-1 text-sm rounded ${
              showUsers ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Eye className="w-3 h-3 mr-1" />
            Active Users
          </button>
          
          <button
            onClick={() => setShowComments(!showComments)}
            className={`px-3 py-1 text-sm rounded ${
              showComments ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <MessageSquare className="w-3 h-3 mr-1" />
            Comments
          </button>
          
          <button className="p-1 text-gray-400 hover:text-gray-600">
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Active Users */}
      {showUsers && (
        <div className="p-4 border-b border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Active Users ({activeUsers.length})</h4>
          <div className="space-y-2">
            {activeUsers.map(user => (
              <div key={user.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img
                    src={user.avatar || '/avatars/default.jpg'}
                    alt={user.name}
                    className="w-6 h-6 rounded-full"
                  />
                  <span className="text-sm text-gray-700">{user.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(user.status)}`}></div>
                  <span className="text-xs text-gray-500 capitalize">{user.status}</span>
                  {user.cursor && (
                    <span className="text-xs text-gray-400">
                      Line {user.cursor.line}, Col {user.cursor.column}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comments Section */}
      {showComments && (
        <div className="divide-y divide-gray-200">
          {/* New Comment Input */}
          <div className="p-4">
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-gray-600" />
              </div>
              <div className="flex-1">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment... Use @ to mention users"
                  className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
                <div className="flex justify-between items-center mt-2">
                  <div className="text-xs text-gray-500">
                    {newComment.length} characters
                  </div>
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Send className="w-3 h-3" />
                    Comment
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Comments List */}
          <div className="max-h-96 overflow-y-auto" ref={commentsRef}>
            {comments.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">No comments yet</p>
                <p className="text-xs text-gray-400 mt-1">Be the first to comment</p>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {comments.map(comment => (
                  <CommentItem key={comment.id} comment={comment} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Events */}
      <div className="p-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Recent Activity</h4>
        <div className="space-y-2">
          {events.slice(0, 5).map(event => (
            <div key={event.id} className="flex items-center gap-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${
                event.type === 'edit' ? 'bg-blue-500' :
                event.type === 'comment' ? 'bg-green-500' :
                event.type === 'share' ? 'bg-purple-500' :
                'bg-gray-500'
              }`}></div>
              <span className="text-gray-600">
                {event.user.name} {event.action}
              </span>
              <span className="text-xs text-gray-400">
                {formatTime(event.timestamp)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Hook for using collaboration features
export function useCollaboration(resourceId: string, resourceType: string) {
  const [events, setEvents] = useState<CollaborationEvent[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);

  useEffect(() => {
    const unsubscribe = notificationManager.subscribeToCollaboration(setEvents);
    
    const initialEvents = notificationManager.getCollaborationEvents({
      resourceType,
      resourceId,
      limit: 20
    });
    setEvents(initialEvents);

    return unsubscribe;
  }, [resourceId, resourceType]);

  const addEvent = (type: CollaborationEvent['type'], action: string, details?: string) => {
    notificationManager.addCollaborationEvent({
      type,
      resource: { type: resourceType, id: resourceId, name: 'Resource' },
      user: { id: 'current-user', name: 'Current User' },
      action,
      details,
      isRealTime: true
    });
  };

  return {
    events,
    activeUsers,
    addEvent,
    refresh: () => {
      const refreshedEvents = notificationManager.getCollaborationEvents({
        resourceType,
        resourceId,
        limit: 20
      });
      setEvents(refreshedEvents);
    }
  };
}
