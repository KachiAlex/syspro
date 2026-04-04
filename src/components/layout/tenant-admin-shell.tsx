"use client";

import React, { useState, useEffect } from "react";
import { SidebarNav } from "./sidebar-nav";
import { Menu, X, ChevronDown, User, Bell, Settings, Search, Command } from "lucide-react";

export default function TenantAdminShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+K or Cmd+K for search
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      
      // Escape to close modals
      if (event.key === 'Escape') {
        if (searchOpen) {
          setSearchOpen(false);
        }
        if (sidebarOpen) {
          setSidebarOpen(false);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen, sidebarOpen]);

  return (
    <div className="min-h-screen flex bg-gray-50 relative">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Search Overlay */}
      {searchOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50"
          onClick={() => setSearchOpen(false)}
        >
          <div className="flex items-start justify-center pt-20">
            <div 
              className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4">
                <div className="flex items-center gap-3 mb-4">
                  <Search className="w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search anything..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 px-3 py-2 text-lg border-0 outline-none"
                    autoFocus
                  />
                  <button
                    onClick={() => setSearchOpen(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  Press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Ctrl</kbd> + <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">K</kbd> to open search
                </div>
                {/* Search Results */}
                <div className="border-t pt-2">
                  <p className="text-sm text-gray-500 text-center py-4">
                    {searchQuery ? `Searching for "${searchQuery}"...` : "Type to search..."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 border-r border-gray-200 bg-white 
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        flex flex-col h-screen
      `}>
        {/* Mobile header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 lg:hidden">
          <span className="text-lg font-semibold text-gray-900">Navigation</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        
        {/* Sidebar Header - Desktop */}
        <div className="hidden lg:block p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">SysPro</h2>
              <p className="text-sm text-gray-600">Admin Dashboard</p>
            </div>
          </div>
        </div>

        {/* Scrollable Navigation */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          <div className="p-4 lg:p-6">
            <SidebarNav />
          </div>
        </div>

        {/* Sidebar Footer - Desktop */}
        <div className="hidden lg:block border-t border-gray-200 p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-gray-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Admin User</p>
                <p className="text-xs text-gray-500">admin@company.com</p>
              </div>
            </div>
            <button className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex-1 flex items-center justify-center gap-2 p-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">
              <Bell className="w-4 h-4" />
              <span className="hidden lg:inline">Notifications</span>
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 p-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">
              <Settings className="w-4 h-4" />
              <span className="hidden lg:inline">Settings</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-hidden flex flex-col">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Mobile menu button */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Menu className="h-5 w-5 text-gray-500" />
              </button>
              
              {/* Search Bar */}
              <button
                onClick={() => setSearchOpen(true)}
                className="hidden sm:flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors min-w-0 max-w-xs"
              >
                <Search className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500 truncate">Search...</span>
                <kbd className="hidden md:flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                  <Command className="w-3 h-3" />
                  K
                </kbd>
              </button>
              
              {/* Breadcrumb */}
              <nav className="hidden sm:flex items-center gap-2 text-sm text-gray-500">
                <span>Dashboard</span>
                <span>/</span>
                <span className="text-gray-900">Current Page</span>
              </nav>
            </div>
            
            {/* Top bar actions */}
            <div className="flex items-center gap-3">
              <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <Settings className="w-5 h-5" />
              </button>
              <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-gray-200">
                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-gray-600" />
                </div>
                <div className="hidden md:block">
                  <p className="text-sm font-medium text-gray-900">Admin User</p>
                  <p className="text-xs text-gray-500">Administrator</p>
                </div>
              </div>
            </div>
          </div>
        </header>
        
        {/* Page content - independently scrollable */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          <div className="p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
