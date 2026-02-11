import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { CustomerPortalLayout } from "@/components/CustomerPortalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MessageCircle, 
  Send, 
  ArrowLeft, 
  CheckCheck, 
  Check,
  Clock, 
  Bot, 
  User,
  Sparkles,
  RefreshCw,
  Inbox,
  Archive,
  Bell,
  Settings,
  Search,
  Filter,
  MoreVertical,
  Phone,
  Mail,
  Loader2,
  ChevronRight,
  MessageSquare
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function PortalMessages() {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();
  const isKurdish = language === "ku";
  const isDark = theme === "dark";
  const isRTL = language === "ku" || language === "ar";
  
  const [newMessage, setNewMessage] = useState("");
  const [activeTab, setActiveTab] = useState("chat");
  const [chatId, setChatId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const utils = trpc.useUtils();
  
  // Get or create chat
  const getOrCreateChat = trpc.supportChat.getOrCreateChat.useMutation({
    onSuccess: (chat) => {
      setChatId(chat.id);
    },
    onError: (error) => {
      console.error('Failed to create chat:', error);
    }
  });
  
  // Get chat messages
  const messagesQuery = trpc.supportChat.getMessages.useQuery(
    { chatId: chatId! },
    { 
      enabled: !!chatId,
      refetchInterval: 5000,
    }
  );
  
  // Get old customer messages (legacy system)
  const legacyMessagesQuery = trpc.customerPortal.getMyMessages.useQuery();
  
  // Send message mutation
  const sendMessage = trpc.supportChat.sendMessage.useMutation({
    onSuccess: () => {
      setNewMessage("");
      utils.supportChat.getMessages.invalidate({ chatId: chatId! });
    },
    onError: () => {
      toast.error(t('portal.sendMessageFailed'));
    }
  });
  
  // Mark as read mutation
  const markAsRead = trpc.supportChat.markAsRead.useMutation();
  
  // Get unread count
  const unreadQuery = trpc.supportChat.getUnreadCount.useQuery();
  
  // Initialize chat
  useEffect(() => {
    if (!chatId) {
      getOrCreateChat.mutate();
    }
  }, []);
  
  // Mark messages as read when chat is opened
  useEffect(() => {
    if (chatId) {
      markAsRead.mutate({ chatId });
    }
  }, [chatId, messagesQuery.data]);
  
  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesQuery.data]);
  
  const handleSendMessage = () => {
    if (!newMessage.trim() || !chatId) return;
    
    sendMessage.mutate({
      chatId,
      content: newMessage.trim(),
      messageType: 'text',
    });
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  const formatTime = (date: Date | string) => {
    return new Date(date).toLocaleTimeString(isKurdish ? 'ku' : 'en-US', { 
      hour: "2-digit", 
      minute: "2-digit" 
    });
  };
  
  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (d.toDateString() === today.toDateString()) {
      return isKurdish ? "ئەمڕۆ" : "Today";
    } else if (d.toDateString() === yesterday.toDateString()) {
      return isKurdish ? "دوێنێ" : "Yesterday";
    } else {
      return d.toLocaleDateString(isKurdish ? 'ku' : 'en-US');
    }
  };
  
  // Group messages by date
  const groupedMessages = messagesQuery.data?.reduce((groups: Record<string, any[]>, message: any) => {
    const date = formatDate(message.createdAt);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {}) || {};
  
  // Quick replies
  const quickReplies = [
    { text: isKurdish ? "دۆخی داواکاری" : "Request Status", icon: "📦" },
    { text: isKurdish ? "پرسیار لەسەر نرخ" : "Price Question", icon: "💰" },
    { text: isKurdish ? "کێشەی پارەدان" : "Payment Issue", icon: "💳" },
  ];

  return (
    <CustomerPortalLayout>
      <div className={cn(
        "flex flex-col h-[calc(100vh-140px)]",
        isDark ? "bg-slate-900" : "bg-gray-50"
      )}>
        {/* Header */}
        <div className={cn(
          "relative overflow-hidden",
          isDark 
            ? "bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-900" 
            : "bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600"
        )}>
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
          </div>
          
          <div className="relative px-4 py-4">
            <div className="flex items-center gap-3">
              <Link href="/portal">
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-3 flex-1">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <MessageCircle className="h-6 w-6 text-white" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
                </div>
                <div>
                  <h1 className="font-bold text-white text-lg">
                    {isKurdish ? "ناوەندی پەیام" : "Message Center"}
                  </h1>
                  <p className="text-white/70 text-xs flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    {isKurdish ? "پشتگیری ئۆنلاین" : "Support Online"}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => utils.supportChat.getMessages.invalidate({ chatId: chatId! })}
                className="text-white/70 hover:text-white hover:bg-white/10"
                disabled={!chatId}
              >
                <RefreshCw className={cn("w-5 h-5", messagesQuery.isFetching && "animate-spin")} />
              </Button>
            </div>
            
            {/* Tabs */}
            <div className="mt-4">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full bg-white/10 p-1 rounded-xl">
                  <TabsTrigger 
                    value="chat" 
                    className={cn(
                      "flex-1 rounded-lg text-white/70 data-[state=active]:bg-white data-[state=active]:text-purple-600",
                      "transition-all duration-200"
                    )}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    {isKurdish ? "چات" : "Chat"}
                    {(unreadQuery.data || 0) > 0 && (
                      <Badge className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0">
                        {unreadQuery.data}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="notifications" 
                    className={cn(
                      "flex-1 rounded-lg text-white/70 data-[state=active]:bg-white data-[state=active]:text-purple-600",
                      "transition-all duration-200"
                    )}
                  >
                    <Bell className="w-4 h-4 mr-2" />
                    {isKurdish ? "ئاگادارییەکان" : "Notifications"}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </div>
        
        {/* Chat Content */}
        {activeTab === "chat" && (
          <>
            {/* Messages Area */}
            <div className={cn(
              "flex-1 overflow-y-auto px-4 py-4 space-y-4",
              isDark ? "bg-slate-900" : "bg-gray-50"
            )}>
              {/* Loading state */}
              {(getOrCreateChat.isPending || messagesQuery.isLoading) && (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                  <p className={cn(
                    "text-sm",
                    isDark ? "text-slate-400" : "text-slate-600"
                  )}>
                    {isKurdish ? "چاوەڕوانبە..." : "Loading..."}
                  </p>
                </div>
              )}
              
              {/* Empty state */}
              {!getOrCreateChat.isPending && !messagesQuery.isLoading && (!messagesQuery.data || messagesQuery.data.length === 0) && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", duration: 0.5 }}
                    className={cn(
                      "w-24 h-24 rounded-full flex items-center justify-center mb-4",
                      isDark 
                        ? "bg-gradient-to-br from-purple-500/20 to-indigo-500/20" 
                        : "bg-gradient-to-br from-purple-100 to-indigo-100"
                    )}
                  >
                    <Sparkles className={cn(
                      "h-12 w-12",
                      isDark ? "text-purple-400" : "text-purple-500"
                    )} />
                  </motion.div>
                  <h3 className={cn(
                    "font-bold text-lg mb-2",
                    isDark ? "text-white" : "text-gray-800"
                  )}>
                    {isKurdish ? "بەخێربێیت!" : "Welcome!"}
                  </h3>
                  <p className={cn(
                    "text-sm max-w-xs mb-6",
                    isDark ? "text-slate-400" : "text-gray-500"
                  )}>
                    {isKurdish 
                      ? "گفتوگۆیەک دەستپێبکە لەگەڵ تیمی پشتگیریمان. ئێمە لێرەین بۆ یارمەتیدان!" 
                      : "Start a conversation with our support team. We're here to help!"}
                  </p>
                  
                  {/* Quick Replies */}
                  <div className="flex flex-wrap justify-center gap-2">
                    {quickReplies.map((reply, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setNewMessage(reply.text);
                          inputRef.current?.focus();
                        }}
                        className={cn(
                          "rounded-full text-xs",
                          isDark 
                            ? "border-slate-700 hover:bg-slate-800 text-slate-300" 
                            : "border-slate-200 hover:bg-slate-50"
                        )}
                      >
                        <span className="mr-1">{reply.icon}</span>
                        {reply.text}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Messages list */}
              {!getOrCreateChat.isPending && !messagesQuery.isLoading && messagesQuery.data && messagesQuery.data.length > 0 && (
                <>
                  {Object.entries(groupedMessages).map(([date, dateMessages]) => (
                    <div key={date}>
                      {/* Date Separator */}
                      <div className="flex items-center justify-center my-4">
                        <div className={cn(
                          "text-xs px-3 py-1 rounded-full",
                          isDark ? "bg-slate-800 text-slate-400" : "bg-gray-200 text-gray-600"
                        )}>
                          {date}
                        </div>
                      </div>
                      
                      {/* Messages */}
                      {(dateMessages as any[])?.map((message: any, index: number) => (
                        <motion.div
                          key={message.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.02 }}
                          className={cn(
                            "flex mb-3",
                            message.senderType === "customer" ? "justify-end" : "justify-start"
                          )}
                        >
                          {message.senderType !== "customer" && (
                            <Avatar className="w-8 h-8 mr-2 flex-shrink-0">
                              <AvatarFallback className={cn(
                                "text-xs",
                                isDark ? "bg-purple-500/20 text-purple-400" : "bg-purple-100 text-purple-600"
                              )}>
                                {message.senderType === 'bot' ? (
                                  <Bot className="w-4 h-4" />
                                ) : (
                                  <User className="w-4 h-4" />
                                )}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          
                          <div
                            className={cn(
                              "max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm",
                              message.senderType === "customer"
                                ? isDark 
                                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-br-md" 
                                  : "bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-br-md"
                                : isDark
                                  ? "bg-slate-800 text-slate-100 rounded-bl-md"
                                  : "bg-white text-gray-800 rounded-bl-md border border-gray-100"
                            )}
                          >
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            <div
                              className={cn(
                                "flex items-center gap-1 mt-1",
                                message.senderType === "customer" ? "justify-end" : "justify-start"
                              )}
                            >
                              <span
                                className={cn(
                                  "text-[10px]",
                                  message.senderType === "customer" 
                                    ? "text-white/70" 
                                    : isDark ? "text-slate-500" : "text-gray-400"
                                )}
                              >
                                {formatTime(message.createdAt)}
                              </span>
                              {message.senderType === "customer" && (
                                message.isRead ? (
                                  <CheckCheck className="h-3 w-3 text-blue-300" />
                                ) : (
                                  <Check className="h-3 w-3 text-white/70" />
                                )
                              )}
                            </div>
                          </div>
                          
                          {message.senderType === "customer" && (
                            <Avatar className="w-8 h-8 ml-2 flex-shrink-0">
                              <AvatarFallback className={cn(
                                "text-xs",
                                isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-600"
                              )}>
                                <User className="w-4 h-4" />
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>
            
            {/* Input Area */}
            <div className={cn(
              "border-t px-4 py-3",
              isDark ? "border-slate-700 bg-slate-900" : "border-gray-200 bg-white"
            )}>
              <div className="flex items-center gap-2">
                <Input
                  ref={inputRef}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={isKurdish ? "نامەکەت بنووسە..." : "Type a message..."}
                  className={cn(
                    "flex-1 rounded-full",
                    isDark 
                      ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" 
                      : "border-gray-200 focus:border-purple-500 focus:ring-purple-500"
                  )}
                  disabled={!chatId || sendMessage.isPending}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || !chatId || sendMessage.isPending}
                  className={cn(
                    "rounded-full w-10 h-10 p-0",
                    "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                  )}
                >
                  {sendMessage.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className={cn(
                "text-xs text-center mt-2",
                isDark ? "text-slate-500" : "text-gray-400"
              )}>
                {isKurdish 
                  ? "تیمی پشتگیریمان بە زووترین کات وەڵامت دەداتەوە" 
                  : "Our team typically responds within a few hours"}
              </p>
            </div>
          </>
        )}
        
        {/* Notifications Tab */}
        {activeTab === "notifications" && (
          <div className={cn(
            "flex-1 overflow-y-auto px-4 py-4",
            isDark ? "bg-slate-900" : "bg-gray-50"
          )}>
            <div className="flex flex-col items-center justify-center h-full text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", duration: 0.5 }}
                className={cn(
                  "w-24 h-24 rounded-full flex items-center justify-center mb-4",
                  isDark 
                    ? "bg-gradient-to-br from-amber-500/20 to-orange-500/20" 
                    : "bg-gradient-to-br from-amber-100 to-orange-100"
                )}
              >
                <Bell className={cn(
                  "h-12 w-12",
                  isDark ? "text-amber-400" : "text-amber-500"
                )} />
              </motion.div>
              <h3 className={cn(
                "font-bold text-lg mb-2",
                isDark ? "text-white" : "text-gray-800"
              )}>
                {isKurdish ? "ئاگاداری نییە" : "No Notifications"}
              </h3>
              <p className={cn(
                "text-sm max-w-xs",
                isDark ? "text-slate-400" : "text-gray-500"
              )}>
                {isKurdish 
                  ? "کاتێک ئاگاداریت هەبێت، لێرە دەردەکەوێت" 
                  : "When you have notifications, they'll appear here"}
              </p>
            </div>
          </div>
        )}
        
        {/* Contact Info Footer */}
        <div className={cn(
          "border-t px-4 py-3",
          isDark ? "border-slate-700 bg-slate-800/50" : "border-gray-200 bg-gray-50"
        )}>
          <div className="flex items-center justify-center gap-6">
            <a 
              href="tel:+9647501234567" 
              className={cn(
                "flex items-center gap-2 text-sm",
                isDark ? "text-slate-400 hover:text-white" : "text-gray-500 hover:text-gray-800"
              )}
            >
              <Phone className="w-4 h-4" />
              <span>{isKurdish ? "پەیوەندی" : "Call"}</span>
            </a>
            <a 
              href="mailto:support@waznexpress.com" 
              className={cn(
                "flex items-center gap-2 text-sm",
                isDark ? "text-slate-400 hover:text-white" : "text-gray-500 hover:text-gray-800"
              )}
            >
              <Mail className="w-4 h-4" />
              <span>{isKurdish ? "ئیمەیل" : "Email"}</span>
            </a>
          </div>
        </div>
      </div>
    </CustomerPortalLayout>
  );
}
