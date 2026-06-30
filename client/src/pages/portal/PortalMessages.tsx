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
import { pickLang } from "@/lib/lang";
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
  MessageSquare,
  Image as ImageIcon,
  Paperclip,
  FileText,
  Download,
  X,
  Mic,
  Square,
  Play,
  Pause
} from "lucide-react";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
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
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isRecording, formattedDuration, startRecording, stopRecording, cancelRecording } = useVoiceRecorder();
  
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

  // Upload mutation for files/images
  const uploadMutation = trpc.storage.upload.useMutation();
  
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
  
  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !attachmentFile) || !chatId) return;

    let attachmentUrl: string | undefined;
    let attachmentName: string | undefined;
    let attachmentType: string | undefined;
    let messageType: "text" | "image" | "file" = "text";

    if (attachmentFile) {
      setIsUploading(true);
      try {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(attachmentFile);
        });

        const result = await uploadMutation.mutateAsync({
          fileName: attachmentFile.name,
          contentType: attachmentFile.type,
          base64Data: base64,
        });

        attachmentUrl = result.url;
        attachmentName = attachmentFile.name;
        attachmentType = attachmentFile.type;
        messageType = attachmentFile.type.startsWith("image/") ? "image" : "file";
      } catch {
        toast.error(pickLang(language, { ku: "هەڵە لە ئەپڵۆدکردنی فایل", en: "File upload failed", ar: "فشل رفع الملف", zh: "文件上传失败" }));
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    sendMessage.mutate({
      chatId,
      content: newMessage.trim() || (attachmentName ? `📎 ${attachmentName}` : ""),
      messageType,
      attachmentUrl,
      attachmentName,
      attachmentType,
    });

    setAttachmentFile(null);
    if (attachmentPreview) {
      URL.revokeObjectURL(attachmentPreview);
      setAttachmentPreview(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "file") => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error(pickLang(language, { ku: "فایل زۆر گەورەیە (max 10MB)", en: "File too large (max 10MB)", ar: "الملف كبير جداً (الحد الأقصى 10 ميغابايت)", zh: "文件过大（最大 10MB）" }));
      return;
    }
    setAttachmentFile(file);
    if (type === "image" && file.type.startsWith("image/")) {
      setAttachmentPreview(URL.createObjectURL(file));
    } else {
      setAttachmentPreview(null);
    }
    e.target.value = "";
  };

  const clearAttachment = () => {
    setAttachmentFile(null);
    if (attachmentPreview) {
      URL.revokeObjectURL(attachmentPreview);
      setAttachmentPreview(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleVoiceSend = async () => {
    const file = await stopRecording();
    if (!file || !chatId) return;

    setIsUploading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const result = await uploadMutation.mutateAsync({
        fileName: file.name,
        contentType: file.type,
        base64Data: base64,
      });

      sendMessage.mutate({
        chatId,
        content: "🎤 Voice message",
        messageType: "voice" as any,
        attachmentUrl: result.url,
        attachmentName: file.name,
        attachmentType: file.type,
      });
    } catch {
      toast.error(pickLang(language, { ku: "هەڵە لە ناردنی دەنگ", en: "Voice send failed", ar: "فشل إرسال الرسالة الصوتية", zh: "语音发送失败" }));
    }
    setIsUploading(false);
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
      return pickLang(language, { ku: "ئەمڕۆ", en: "Today", ar: "اليوم", zh: "今天" });
    } else if (d.toDateString() === yesterday.toDateString()) {
      return pickLang(language, { ku: "دوێنێ", en: "Yesterday", ar: "أمس", zh: "昨天" });
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
    { text: pickLang(language, { ku: "دۆخی داواکاری", en: "Request Status", ar: "حالة الطلب", zh: "请求状态" }), icon: "📦" },
    { text: pickLang(language, { ku: "پرسیار لەسەر نرخ", en: "Price Question", ar: "استفسار عن السعر", zh: "价格咨询" }), icon: "💰" },
    { text: pickLang(language, { ku: "کێشەی پارەدان", en: "Payment Issue", ar: "مشكلة في الدفع", zh: "付款问题" }), icon: "💳" },
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
                    {pickLang(language, { ku: "ناوەندی پەیام", en: "Message Center", ar: "مركز الرسائل", zh: "消息中心" })}
                  </h1>
                  <p className="text-white/70 text-xs flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    {pickLang(language, { ku: "پشتگیری ئۆنلاین", en: "Support Online", ar: "الدعم متصل", zh: "客服在线" })}
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
                    <MessageSquare className="w-4 h-4 me-2" />
                    {pickLang(language, { ku: "چات", en: "Chat", ar: "الدردشة", zh: "聊天" })}
                    {(unreadQuery.data || 0) > 0 && (
                      <Badge className="ms-2 bg-red-500 text-white text-xs px-1.5 py-0">
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
                    <Bell className="w-4 h-4 me-2" />
                    {pickLang(language, { ku: "ئاگادارییەکان", en: "Notifications", ar: "الإشعارات", zh: "通知" })}
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
                    {pickLang(language, { ku: "چاوەڕوانبە...", en: "Loading...", ar: "جارٍ التحميل...", zh: "加载中..." })}
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
                    {pickLang(language, { ku: "بەخێربێیت!", en: "Welcome!", ar: "أهلاً بك!", zh: "欢迎！" })}
                  </h3>
                  <p className={cn(
                    "text-sm max-w-xs mb-6",
                    isDark ? "text-slate-400" : "text-gray-500"
                  )}>
                    {pickLang(language, { ku: "گفتوگۆیەک دەستپێبکە لەگەڵ تیمی پشتگیریمان. ئێمە لێرەین بۆ یارمەتیدان!", en: "Start a conversation with our support team. We're here to help!", ar: "ابدأ محادثة مع فريق الدعم لدينا. نحن هنا لمساعدتك!", zh: "与我们的客服团队开始对话。我们随时为您提供帮助！" })}
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
                        <span className="me-1">{reply.icon}</span>
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
                            {/* Image attachment */}
                            {message.messageType === "image" && message.attachmentUrl && (
                              <div className="mb-1">
                                <img
                                  src={message.attachmentUrl}
                                  alt={message.attachmentName || "image"}
                                  className="max-w-[200px] rounded-lg cursor-pointer hover:opacity-90 transition"
                                  onClick={() => window.open(message.attachmentUrl, "_blank")}
                                />
                              </div>
                            )}
                            {/* File attachment */}
                            {message.messageType === "file" && message.attachmentUrl && (
                              <a
                                href={message.attachmentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                  "flex items-center gap-2 mb-1 p-2 rounded-lg text-sm transition",
                                  message.senderType === "customer"
                                    ? "bg-white/10 hover:bg-white/20"
                                    : isDark
                                      ? "bg-slate-700 hover:bg-slate-600"
                                      : "bg-gray-100 hover:bg-gray-200"
                                )}
                              >
                                <FileText className="w-4 h-4 shrink-0" />
                                <span className="truncate">{message.attachmentName || "File"}</span>
                                <Download className="w-3.5 h-3.5 shrink-0 ms-auto" />
                              </a>
                            )}
                            {/* Voice message */}
                            {message.messageType === "voice" && message.attachmentUrl && (
                              <div className="mb-1">
                                <audio controls className="max-w-[220px] h-8" preload="metadata">
                                  <source src={message.attachmentUrl} type={message.attachmentType || "audio/webm"} />
                                </audio>
                              </div>
                            )}
                            {/* Text content */}
                            {message.content && message.messageType === "text" && (
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            )}
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
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>
            
            {/* Attachment Preview */}
            {attachmentFile && (
              <div className={cn(
                "px-4 pt-3 border-t",
                isDark ? "border-slate-700 bg-slate-900" : "border-gray-200 bg-white"
              )}>
                <div className={cn(
                  "flex items-center gap-3 p-2 rounded-lg",
                  isDark ? "bg-slate-800" : "bg-gray-100"
                )}>
                  {attachmentPreview ? (
                    <img src={attachmentPreview} alt="" className="w-14 h-14 rounded object-cover" />
                  ) : (
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", isDark ? "bg-purple-500/20" : "bg-purple-100")}>
                      <FileText className={cn("w-5 h-5", isDark ? "text-purple-400" : "text-purple-600")} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium truncate", isDark ? "text-white" : "")}>{attachmentFile.name}</p>
                    <p className={cn("text-xs", isDark ? "text-slate-400" : "text-gray-500")}>{(attachmentFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button onClick={clearAttachment} className={cn("p-1 rounded hover:bg-gray-200", isDark && "hover:bg-slate-700")}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className={cn(
              "border-t px-4 py-3",
              isDark ? "border-slate-700 bg-slate-900" : "border-gray-200 bg-white"
            )}>
              <div className="flex items-center gap-2">
                {/* Attachment buttons */}
                <button
                  onClick={() => imageInputRef.current?.click()}
                  className={cn(
                    "p-2 rounded-full transition",
                    isDark ? "hover:bg-slate-800 text-slate-400 hover:text-purple-400" : "hover:bg-gray-100 text-gray-400 hover:text-purple-600"
                  )}
                  disabled={!chatId}
                >
                  <ImageIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "p-2 rounded-full transition",
                    isDark ? "hover:bg-slate-800 text-slate-400 hover:text-purple-400" : "hover:bg-gray-100 text-gray-400 hover:text-purple-600"
                  )}
                  disabled={!chatId}
                >
                  <Paperclip className="w-5 h-5" />
                </button>

                {isRecording ? (
                  /* Recording UI */
                  <div className="flex-1 flex items-center gap-3">
                    <button
                      onClick={cancelRecording}
                      className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <div className="flex-1 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                      <span className={cn("text-sm font-mono font-medium", isDark ? "text-white" : "text-gray-800")}>
                        {formattedDuration}
                      </span>
                      <span className={cn("text-xs", isDark ? "text-slate-400" : "text-gray-500")}>
                        {pickLang(language, { ku: "تۆمارکردن...", en: "Recording...", ar: "جارٍ التسجيل...", zh: "录音中..." })}
                      </span>
                    </div>
                    <Button
                      onClick={handleVoiceSend}
                      disabled={isUploading}
                      className={cn(
                        "rounded-full w-10 h-10 p-0",
                        "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                      )}
                    >
                      {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                ) : (
                  /* Normal input UI */
                  <>
                    <Input
                      ref={inputRef}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder={pickLang(language, { ku: "نامەکەت بنووسە...", en: "Type a message...", ar: "اكتب رسالة...", zh: "输入消息..." })}
                      className={cn(
                        "flex-1 rounded-full",
                        isDark
                          ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                          : "border-gray-200 focus:border-purple-500 focus:ring-purple-500"
                      )}
                      disabled={!chatId || sendMessage.isPending || isUploading}
                    />
                    {newMessage.trim() || attachmentFile ? (
                      <Button
                        onClick={handleSendMessage}
                        disabled={sendMessage.isPending || isUploading}
                        className={cn(
                          "rounded-full w-10 h-10 p-0",
                          "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                        )}
                      >
                        {sendMessage.isPending || isUploading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    ) : (
                      <button
                        onClick={async () => {
                          const ok = await startRecording();
                          if (!ok) toast.error(pickLang(language, { ku: "ڕێگەپێدانی مایکرۆفۆن نییە", en: "Microphone permission denied", ar: "تم رفض إذن الميكروفون", zh: "麦克风权限被拒绝" }));
                        }}
                        disabled={!chatId}
                        className={cn(
                          "rounded-full w-10 h-10 flex items-center justify-center transition",
                          isDark ? "hover:bg-slate-800 text-slate-400 hover:text-purple-400" : "hover:bg-gray-100 text-gray-400 hover:text-purple-600"
                        )}
                      >
                        <Mic className="w-5 h-5" />
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Hidden file inputs */}
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, "image")} />
              <input ref={fileInputRef} type="file" accept="*/*" className="hidden" onChange={(e) => handleFileSelect(e, "file")} />

              <p className={cn(
                "text-xs text-center mt-2",
                isDark ? "text-slate-500" : "text-gray-400"
              )}>
                {pickLang(language, { ku: "تیمی پشتگیریمان بە زووترین کات وەڵامت دەداتەوە", en: "Our team typically responds within a few hours", ar: "يرد فريقنا عادةً خلال بضع ساعات", zh: "我们的团队通常会在几小时内回复" })}
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
                {pickLang(language, { ku: "ئاگاداری نییە", en: "No Notifications", ar: "لا توجد إشعارات", zh: "暂无通知" })}
              </h3>
              <p className={cn(
                "text-sm max-w-xs",
                isDark ? "text-slate-400" : "text-gray-500"
              )}>
                {pickLang(language, { ku: "کاتێک ئاگاداریت هەبێت، لێرە دەردەکەوێت", en: "When you have notifications, they'll appear here", ar: "عند وصول إشعارات، ستظهر هنا", zh: "当您有通知时，将显示在这里" })}
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
              <span>{pickLang(language, { ku: "پەیوەندی", en: "Call", ar: "اتصال", zh: "致电" })}</span>
            </a>
            <a 
              href="mailto:support@waznexpress.com" 
              className={cn(
                "flex items-center gap-2 text-sm",
                isDark ? "text-slate-400 hover:text-white" : "text-gray-500 hover:text-gray-800"
              )}
            >
              <Mail className="w-4 h-4" />
              <span>{pickLang(language, { ku: "ئیمەیل", en: "Email", ar: "البريد الإلكتروني", zh: "电子邮件" })}</span>
            </a>
          </div>
        </div>
      </div>
    </CustomerPortalLayout>
  );
}
