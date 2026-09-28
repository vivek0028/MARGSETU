import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Train,
  Menu,
  Search,
  Bell,
  User,
  LogOut,
  ExternalLink,
  CheckCircle2,
  X,
  Shield,
  Layers,
  Wrench,
  Calendar,
  AlertTriangle
} from "lucide-react";
import { usePlanning } from "../context/PlanningContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { InAppNotification, GlobalSearchResult } from "../types";

export const Header: React.FC = () => {
  const { syncNotice, sidebarOpen, toggleSidebar } = usePlanning();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Global Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Notifications State
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // User Menu State
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const data: any = await api.getNotifications(false);
      const list = Array.isArray(data) ? data : (data?.notifications || []);
      setNotifications(Array.isArray(list) ? list : []);
    } catch {
      setNotifications([]);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Handle outside clicks to close popovers
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search trigger
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.searchAll(searchQuery);
        setSearchResults(res.results || []);
        setSearchOpen(true);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const markRead = async (notifId: string) => {
    try {
      await api.markNotificationRead(notifId);
      setNotifications((prev) => prev.map((n) => (n.notification_id === notifId ? { ...n, read: true } : n)));
    } catch {
      // ignore
    }
  };

  const markAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // ignore
    }
  };

  const unreadCount = Array.isArray(notifications)
    ? notifications.filter((n) => !n.read && !n.is_read).length
    : 0;

  const getResultIcon = (cat: string) => {
    switch (cat) {
      case "TASK":
        return <Wrench className="w-3.5 h-3.5 text-blue-500" />;
      case "ASSET":
        return <Layers className="w-3.5 h-3.5 text-emerald-500" />;
      case "BLOCK":
        return <Calendar className="w-3.5 h-3.5 text-purple-500" />;
      case "TRAIN":
        return <Train className="w-3.5 h-3.5 text-sky-500" />;
      case "CONFLICT":
        return <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />;
      default:
        return <Search className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <header className="bg-[#0B192C] text-white border-b border-slate-800/80 sticky top-0 z-30 shadow-md select-none">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-5">
        <div className="flex items-center justify-between h-14">
          {/* Left Brand & Menu Toggle */}
          <div className="flex items-center space-x-3">
            <button
              onClick={toggleSidebar}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer shadow-xs active:scale-95 group ${
                sidebarOpen
                  ? "bg-blue-600 text-white border border-blue-400/60 shadow-blue-900/40 ring-2 ring-blue-500/30"
                  : "bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700/80 hover:text-white"
              }`}
              title="Navigation Menu (Esc)"
              aria-label="Toggle Navigation Drawer"
            >
              <Menu className="w-4 h-4 text-blue-400 group-hover:text-white transition" />
              <span className="font-semibold tracking-wide text-xs">Menu</span>
            </button>

            <Link to="/" className="flex items-center space-x-2.5 group transition">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0056B3] to-[#0A3161] flex items-center justify-center text-white shadow-xs font-black border border-blue-400/30 group-hover:border-blue-400/60 transition">
                <Train className="w-4.5 h-4.5 text-white" />
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center space-x-2">
                  <span className="font-black text-base tracking-wider text-white">MARGSETU</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                    IR ENTERPRISE
                  </span>
                </div>
                <p className="text-[10px] text-slate-300 font-medium tracking-normal -mt-0.5 leading-tight">
                  Maintenance &amp; Block Planning Platform
                </p>
              </div>
            </Link>
          </div>

          {/* Center: Global Search Bar */}
          <div ref={searchRef} className="relative flex-1 max-w-md mx-4 hidden md:block">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => {
                  if (searchResults.length > 0) setSearchOpen(true);
                }}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Global search (tasks, assets, trains, block slots)..."
                className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                    setSearchOpen(false);
                  }}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Live Search Results Dropdown */}
            {searchOpen && (
              <div className="absolute left-0 right-0 mt-1.5 bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-fadeIn">
                <div className="p-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500">
                  <span>SEARCH RESULTS ({searchResults.length})</span>
                  {isSearching && <span className="text-blue-600 animate-pulse">Searching...</span>}
                </div>

                {searchResults.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    No results found for &quot;{searchQuery}&quot;
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {searchResults.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setSearchOpen(false);
                          navigate(item.url);
                        }}
                        className="p-2.5 hover:bg-blue-50/70 transition cursor-pointer flex items-center justify-between group"
                      >
                        <div className="flex items-center space-x-2.5">
                          <span className="p-1.5 rounded-lg bg-slate-100 group-hover:bg-blue-100">
                            {getResultIcon(item.category)}
                          </span>
                          <div>
                            <div className="font-bold text-xs text-slate-900">{item.title}</div>
                            <div className="text-[11px] text-slate-500">{item.subtitle}</div>
                          </div>
                        </div>
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
                          {item.category}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Controls: Notifications & User Profile */}
          <div className="flex items-center space-x-2.5">
            {/* Notification Bell */}
            <div ref={notifRef} className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white transition relative cursor-pointer"
                title="Notifications"
                aria-label="View notifications"
              >
                <Bell className="w-4 h-4 text-slate-300" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white font-black text-[9px] flex items-center justify-center animate-pulse">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover */}
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-fadeIn">
                  <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
                    <span className="font-black text-slate-900">Notifications ({unreadCount} new)</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">No notifications yet.</div>
                    ) : (
                      notifications.map((n) => {
                        const notifId = n.notification_id || n.id || Math.random().toString();
                        const isRead = Boolean(n.read || n.is_read);
                        return (
                          <div
                            key={notifId}
                            onClick={() => markRead(notifId)}
                            className={`p-3 transition cursor-pointer flex items-start space-x-2.5 ${
                              isRead ? "bg-white opacity-80" : "bg-blue-50/40"
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                                isRead ? "bg-slate-300" : "bg-blue-600"
                              }`}
                            />
                          <div className="flex-1 space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-slate-900">{n.title}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {n.created_at
                                  ? new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                  : "Just now"}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 leading-relaxed">{n.message}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Avatar & Dropdown */}
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center space-x-2 p-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 transition cursor-pointer border border-slate-700/80"
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xs">
                  {user?.full_name?.charAt(0) || "U"}
                </div>
                <div className="hidden lg:block text-left text-xs pr-1">
                  <div className="font-bold text-white leading-tight truncate max-w-[120px]">
                    {user?.full_name || "Railway Officer"}
                  </div>
                  <div className="text-[10px] text-blue-300 font-mono leading-tight">
                    {user?.role || "PLANNER"}
                  </div>
                </div>
              </button>

              {/* User Dropdown */}
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-fadeIn">
                  <div className="p-3 bg-slate-50 border-b border-slate-100">
                    <div className="font-bold text-xs text-slate-900">{user?.full_name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{user?.email}</div>
                    <div className="mt-1.5 inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800">
                      <Shield className="w-3 h-3" />
                      <span>{user?.role}</span>
                    </div>
                  </div>

                  <div className="p-1 space-y-0.5 text-xs">
                    <Link
                      to="/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center space-x-2 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 transition"
                    >
                      <User className="w-4 h-4 text-slate-400" />
                      <span>Officer Profile</span>
                    </Link>

                    <Link
                      to="/admin"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center space-x-2 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 transition"
                    >
                      <Shield className="w-4 h-4 text-slate-400" />
                      <span>System Administration</span>
                    </Link>

                    <div className="border-t border-slate-100 my-1" />

                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        logout();
                        navigate("/login");
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="font-bold">Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {syncNotice && (
        <div className="bg-emerald-700 text-white text-xs py-1 px-4 text-center font-semibold tracking-wide border-t border-emerald-600 animate-fadeIn">
          {syncNotice}
        </div>
      )}
    </header>
  );
};
