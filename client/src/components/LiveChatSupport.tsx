import { useState, useEffect, useRef, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  Send,
  X,
  Minimize2,
  Maximize2,
  Phone,
  Mail,
  Clock,
  CheckCheck,
  Check,
  Smile,
  Paperclip,
  Image as ImageIcon,
  MoreVertical,
  Sparkles,
  Bot,
  User,
  ArrowDown,
  Loader2,
  RefreshCw
} from "lucide-react";

interface Message {
  id: number;
  content: string;
  senderType: 'customer' | 'staff' | 'system' | 'bot';
  senderName?: string;
  createdAt: Date;
  isRead: boolean;
  messageType: 'text' | 'image' | 'file' | 'system';
  attachmentUrl?: string;
}

interface LiveChatSupportProps {
  isOpen: boolean;
  onClose: () => void;
  onMinimize?: () => void;
}

export function LiveChatSupport({ isOpen, onClose, onMinimize }: LiveChatSupportProps) {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();
  const company = useCompanyInfo();
  const isKurdish = language === "ku";
  const isDark = theme === "dark";
  const isRTL = language === "ku" || language === "ar";
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [chatId, setChatId] = useState<number | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const utils = trpc.useUtils();
  
  // Get or create chat mutation
  const getOrCreateChat = trpc.supportChat.getOrCreateChat.useMutation({
    onSuccess: (chat) => {
      setChatId(chat.id);
    },
    onError: (error) => {
      console.error('Failed to create chat:', error);
      toast.error(pickLang(language, { ku: 'هەڵەیەک ڕوویدا', en: 'An error occurred', ar: 'حدث خطأ', zh: '发生错误' }));
    }
  });
  
  // Get messages query
  const messagesQuery = trpc.supportChat.getMessages.useQuery(
    { chatId: chatId! },
    { 
      enabled: !!chatId,
      refetchInterval: 5000, // Poll every 5 seconds
    }
  );
  
  // Send message mutation
  const sendMessage = trpc.supportChat.sendMessage.useMutation({
    onSuccess: () => {
      utils.supportChat.getMessages.invalidate({ chatId: chatId! });
    },
    onError: (error) => {
      console.error('Failed to send message:', error);
      toast.error(pickLang(language, { ku: 'نەتوانرا نامەکە بنێردرێت', en: 'Failed to send message', ar: 'فشل إرسال الرسالة', zh: '消息发送失败' }));
    }
  });
  
  // Mark as read mutation
  const markAsRead = trpc.supportChat.markAsRead.useMutation();
  
  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);
  
  // Initialize chat when opened
  useEffect(() => {
    if (isOpen && !chatId && !isInitializing && (user as any)?.isCustomer) {
      setIsInitializing(true);
      getOrCreateChat.mutate();
    }
  }, [isOpen, chatId, isInitializing, (user as any)?.isCustomer]);
  
  // Update messages from query
  useEffect(() => {
    if (messagesQuery.data) {
      const formattedMessages: Message[] = messagesQuery.data.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        senderType: msg.senderType,
        senderName: msg.senderName,
        createdAt: new Date(msg.createdAt),
        isRead: msg.isRead,
        messageType: msg.messageType,
        attachmentUrl: msg.attachmentUrl,
      }));
      setMessages(formattedMessages);
      scrollToBottom();
    }
  }, [messagesQuery.data, scrollToBottom]);
  
  // Mark messages as read when chat is opened
  useEffect(() => {
    if (isOpen && chatId && !isMinimized) {
      markAsRead.mutate({ chatId });
    }
  }, [isOpen, chatId, isMinimized]);
  
  // Add welcome message if no messages
  useEffect(() => {
    if (isOpen && chatId && messages.length === 0 && !messagesQuery.isLoading) {
      // Send initial bot message
      const welcomeContent = isKurdish 
        ? `سڵاو ${user?.name || 'خاوەنکار'}! 👋\n\nبەخێربێیت بۆ پشتگیری ${company.name}. چۆن دەتوانم یارمەتیت بدەم؟`
        : `Hello ${user?.name || 'Customer'}! 👋\n\nWelcome to ${company.name} support. How can I help you today?`;
      
      // Only add welcome if no messages exist
      if (messagesQuery.data?.length === 0) {
        sendMessage.mutate({
          chatId,
          content: welcomeContent,
          messageType: 'text',
        });
      }
    }
  }, [isOpen, chatId, messages.length, messagesQuery.isLoading, messagesQuery.data?.length, company.name]);
  
  // Quick replies
  const quickReplies = [
    {
      text: pickLang(language, { ku: "دۆخی داواکاری", en: "Request Status", ar: "حالة الطلب", zh: "请求状态" }),
      icon: "📦"
    },
    {
      text: pickLang(language, { ku: "پرسیار لەسەر نرخ", en: "Price Question", ar: "استفسار عن السعر", zh: "价格咨询" }),
      icon: "💰"
    },
    {
      text: pickLang(language, { ku: "کێشەی پارەدان", en: "Payment Issue", ar: "مشكلة في الدفع", zh: "支付问题" }),
      icon: "💳"
    },
    {
      text: pickLang(language, { ku: "شتی تر", en: "Something Else", ar: "شيء آخر", zh: "其他" }),
      icon: "❓"
    }
  ];
  
  const handleSendMessage = async () => {
    if (!inputValue.trim() || !chatId) return;
    
    const content = inputValue.trim();
    setInputValue("");
    
    // Optimistically add message
    const tempMessage: Message = {
      id: Date.now(),
      content,
      senderType: 'customer',
      senderName: user?.name || undefined,
      createdAt: new Date(),
      isRead: false,
      messageType: 'text',
    };
    setMessages(prev => [...prev, tempMessage]);
    scrollToBottom();
    
    // Send to server
    sendMessage.mutate({
      chatId,
      content,
      messageType: 'text',
    });
    
    // Simulate bot typing
    setTimeout(() => {
      setIsTyping(true);
    }, 1000);
    
    // Simulate bot response
    setTimeout(() => {
      setIsTyping(false);
      // Auto-reply will be handled by backend in production
      // For now, add a placeholder response
      const autoReply = pickLang(language, {
        ku: "سوپاس بۆ نامەکەت! یەکێک لە تیمی پشتگیریمان بەم زووانە وەڵامت دەداتەوە. کاتی کارکردن: ٩ بەیانی - ٩ ئێوارە",
        en: "Thank you for your message! One of our support team members will respond shortly. Working hours: 9 AM - 9 PM",
        ar: "شكراً لرسالتك! سيرد عليك أحد أعضاء فريق الدعم لدينا قريباً. ساعات العمل: 9 صباحاً - 9 مساءً",
        zh: "感谢您的留言！我们的支持团队成员将很快回复您。工作时间：上午9点 - 晚上9点"
      });
      
      // This would be replaced by actual staff response in production
      // For demo, we'll add a bot message
    }, 3000);
  };
  
  const handleQuickReply = (text: string) => {
    setInputValue(text);
    inputRef.current?.focus();
  };
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(isKurdish ? 'ku' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const getStatusIcon = (isRead: boolean, senderType: string) => {
    if (senderType !== 'customer') return null;
    
    if (isRead) {
      return <CheckCheck className="w-3 h-3 text-blue-500" />;
    }
    return <Check className="w-3 h-3 text-slate-400" />;
  };
  
  if (!isOpen) return null;
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100, scale: 0.9 }}
        animate={{ 
          opacity: 1, 
          y: 0, 
          scale: 1,
          height: isMinimized ? 'auto' : '600px'
        }}
        exit={{ opacity: 0, y: 100, scale: 0.9 }}
        transition={{ type: "spring", duration: 0.5 }}
        className={cn(
          "fixed bottom-4 z-50 w-[380px] rounded-2xl shadow-2xl overflow-hidden",
          isRTL ? "left-4" : "right-4",
          isDark ? "bg-slate-900 border border-slate-700" : "bg-white border border-slate-200"
        )}
        style={{ maxHeight: 'calc(100vh - 100px)' }}
      >
        {/* Header */}
        <div className={cn(
          "relative overflow-hidden",
          isDark 
            ? "bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-900" 
            : "bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600"
        )}>
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-20 h-20 bg-white/10 rounded-full blur-xl" />
            <div className="absolute -bottom-10 -left-10 w-20 h-20 bg-white/10 rounded-full blur-xl" />
          </div>
          
          <div className="relative p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="w-10 h-10 border-2 border-white/30">
                    <AvatarImage src="/support-avatar.png" />
                    <AvatarFallback className="bg-white/20 text-white">
                      <MessageCircle className="w-5 h-5" />
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">
                    {pickLang(language, { ku: "پشتگیری Wazn", en: "Wazn Support", ar: "دعم Wazn", zh: "Wazn 支持" })}
                  </h3>
                  <p className="text-white/70 text-xs flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    {pickLang(language, { ku: "ئۆنلاین", en: "Online", ar: "متصل", zh: "在线" })}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => utils.supportChat.getMessages.invalidate({ chatId: chatId! })}
                  className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8"
                  disabled={!chatId}
                >
                  <RefreshCw className={cn("w-4 h-4", messagesQuery.isFetching && "animate-spin")} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8"
                >
                  {isMinimized ? (
                    <Maximize2 className="w-4 h-4" />
                  ) : (
                    <Minimize2 className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Chat Content */}
        <AnimatePresence>
          {!isMinimized && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex flex-col"
            >
              {/* Messages */}
              <div 
                className={cn(
                  "flex-1 overflow-y-auto p-4 space-y-4",
                  isDark ? "bg-slate-900" : "bg-slate-50"
                )}
                style={{ height: '380px' }}
              >
                {/* Loading state */}
                {(getOrCreateChat.isPending || messagesQuery.isLoading) && (
                  <div className="flex flex-col items-center justify-center h-full gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                    <p className={cn(
                      "text-sm",
                      isDark ? "text-slate-400" : "text-slate-600"
                    )}>
                      {pickLang(language, { ku: "چاوەڕوانبە...", en: "Loading...", ar: "جارٍ التحميل...", zh: "加载中..." })}
                    </p>
                  </div>
                )}
                
                {/* Messages list */}
                {!getOrCreateChat.isPending && !messagesQuery.isLoading && messages.map((message, index) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className={cn(
                      "flex",
                      message.senderType === 'customer' ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.senderType !== 'customer' && (
                      <Avatar className="w-8 h-8 me-2 flex-shrink-0">
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
                    
                    <div className={cn(
                      "max-w-[75%] rounded-2xl px-4 py-2.5",
                      message.senderType === 'customer'
                        ? isDark 
                          ? "bg-purple-600 text-white" 
                          : "bg-purple-600 text-white"
                        : isDark
                          ? "bg-slate-800 text-slate-100"
                          : "bg-white text-slate-900 shadow-sm"
                    )}>
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <div className={cn(
                        "flex items-center gap-1 mt-1",
                        message.senderType === 'customer' ? "justify-end" : "justify-start"
                      )}>
                        <span className={cn(
                          "text-[10px]",
                          message.senderType === 'customer' 
                            ? "text-white/70" 
                            : isDark ? "text-slate-500" : "text-slate-400"
                        )}>
                          {formatTime(message.createdAt)}
                        </span>
                        {getStatusIcon(message.isRead, message.senderType)}
                      </div>
                    </div>
                    
                    {message.senderType === 'customer' && (
                      <Avatar className="w-8 h-8 ms-2 flex-shrink-0">
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
                
                {/* Typing indicator */}
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-start"
                  >
                    <Avatar className="w-8 h-8 me-2 flex-shrink-0">
                      <AvatarFallback className={cn(
                        "text-xs",
                        isDark ? "bg-purple-500/20 text-purple-400" : "bg-purple-100 text-purple-600"
                      )}>
                        <Bot className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className={cn(
                      "rounded-2xl px-4 py-3",
                      isDark ? "bg-slate-800" : "bg-white shadow-sm"
                    )}>
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </motion.div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
              
              {/* Quick Replies */}
              {messages.length <= 1 && !messagesQuery.isLoading && (
                <div className={cn(
                  "px-4 py-2 border-t",
                  isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"
                )}>
                  <p className={cn(
                    "text-xs mb-2",
                    isDark ? "text-slate-400" : "text-slate-500"
                  )}>
                    {pickLang(language, { ku: "وەڵامی خێرا:", en: "Quick replies:", ar: "ردود سريعة:", zh: "快捷回复：" })}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {quickReplies.map((reply, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => handleQuickReply(reply.text)}
                        className={cn(
                          "text-xs h-8 rounded-full",
                          isDark 
                            ? "border-slate-700 hover:bg-slate-800" 
                            : "border-slate-200 hover:bg-slate-50"
                        )}
                      >
                        <span className="me-1">{reply.icon}</span>
                        {reply.text}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Input */}
              <div className={cn(
                "p-4 border-t",
                isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"
              )}>
                <div className="flex items-center gap-2">
                  <Input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                    placeholder={pickLang(language, { ku: "نامەکەت بنووسە...", en: "Type your message...", ar: "اكتب رسالتك...", zh: "输入您的消息..." })}
                    className={cn(
                      "flex-1 rounded-full",
                      isDark 
                        ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" 
                        : "bg-slate-100 border-slate-200"
                    )}
                    disabled={!chatId || sendMessage.isPending}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || !chatId || sendMessage.isPending}
                    size="icon"
                    className={cn(
                      "rounded-full h-10 w-10",
                      "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                    )}
                  >
                    {sendMessage.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}

// Floating chat button component
interface ChatFloatingButtonProps {
  onClick: () => void;
  unreadCount?: number;
}

export function ChatFloatingButton({ onClick, unreadCount = 0 }: ChatFloatingButtonProps) {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isRTL = language === "ku" || language === "ar";
  const isDark = theme === "dark";
  
  // Get unread count from backend
  const unreadQuery = trpc.supportChat.getUnreadCount.useQuery(undefined, {
    refetchInterval: 60000, // Poll every 60 seconds
  });
  
  const totalUnread = unreadQuery.data || unreadCount;
  
  return (
    <motion.button
      onClick={onClick}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        "fixed z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center",
        "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700",
        "transition-all duration-300",
        isRTL ? "left-4" : "right-4",
        "bottom-24" // Above bottom navigation
      )}
    >
      <MessageCircle className="w-6 h-6 text-white" />
      {totalUnread > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center"
        >
          {totalUnread > 9 ? '9+' : totalUnread}
        </motion.span>
      )}
    </motion.button>
  );
}
