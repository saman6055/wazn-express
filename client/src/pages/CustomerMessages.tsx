import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  MessageCircle,
  Send,
  User,
  Clock,
  ArrowLeft,
  Search,
  CheckCheck,
  Circle,
  Image as ImageIcon,
  Paperclip,
  Mic,
  X,
  FileText,
  Download,
  Loader2,
  Inbox,
  Square,
} from "lucide-react";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";

export default function CustomerMessages() {
  const { t, language } = useTranslation();
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { isRecording, formattedDuration, startRecording, stopRecording, cancelRecording } = useVoiceRecorder();

  const utils = trpc.useUtils();

  // Fetch all chats (staff endpoint) with polling
  const { data: chatsRaw, isLoading: loadingChats } =
    trpc.supportChat.getAllChats.useQuery(undefined, {
      refetchInterval: 15000,
    });
  // getAllChats returns { chats, total } — extract the array
  const chats = Array.isArray(chatsRaw) ? chatsRaw : (chatsRaw as any)?.chats;

  // Fetch messages for selected chat with polling
  const { data: messages, isLoading: loadingMessages } =
    trpc.supportChat.getMessages.useQuery(
      { chatId: selectedChatId! },
      { enabled: !!selectedChatId, refetchInterval: 3000 }
    );

  // Send message mutation
  const sendMessageMutation = trpc.supportChat.sendMessage.useMutation({
    onSuccess: () => {
      setNewMessage("");
      setAttachmentFile(null);
      setAttachmentPreview(null);
      utils.supportChat.getMessages.invalidate({ chatId: selectedChatId! });
      utils.supportChat.getAllChats.invalidate();
    },
    onError: () => {
      toast.error(pickLang(language, { ku: "هەڵە لە ناردنی پەیام", en: "Error sending message", ar: "خطأ في إرسال الرسالة", zh: "发送消息出错" }));
    },
  });

  // Mark as read when selecting a chat
  const markAsRead = trpc.supportChat.markAsRead.useMutation({
    onSuccess: () => {
      utils.supportChat.getAllChats.invalidate();
      utils.supportChat.getUnreadCount.invalidate();
    },
  });

  // Upload mutation for files/images
  const uploadMutation = trpc.storage.upload.useMutation();

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark as read when opening a chat
  useEffect(() => {
    if (selectedChatId) {
      markAsRead.mutate({ chatId: selectedChatId });
    }
  }, [selectedChatId]);

  const selectedChat = chats?.find((c: any) => c.id === selectedChatId);

  const filteredChats = chats?.filter(
    (chat: any) =>
      (chat.customerName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (chat.customerCode || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !attachmentFile) || !selectedChatId) return;

    let attachmentUrl: string | undefined;
    let attachmentName: string | undefined;
    let attachmentType: string | undefined;
    let messageType: "text" | "image" | "file" = "text";

    // Upload file if attached
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
        toast.error(pickLang(language, { ku: "هەڵە لە ئەپڵۆدکردنی فایل", en: "Error uploading file", ar: "خطأ في رفع الملف", zh: "上传文件出错" }));
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    sendMessageMutation.mutate({
      chatId: selectedChatId,
      content: newMessage.trim() || (attachmentName ? `📎 ${attachmentName}` : ""),
      messageType,
      attachmentUrl,
      attachmentName,
      attachmentType,
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "file") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error(pickLang(language, { ku: "فایل زۆر گەورەیە (max 10MB)", en: "File is too large (max 10MB)", ar: "الملف كبير جدًا (الحد الأقصى 10 ميغابايت)", zh: "文件过大（最大 10MB）" }));
      return;
    }

    setAttachmentFile(file);

    if (type === "image" && file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setAttachmentPreview(url);
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

  const handleVoiceSend = async () => {
    const file = await stopRecording();
    if (!file || !selectedChatId) return;

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

      sendMessageMutation.mutate({
        chatId: selectedChatId,
        content: "🎤 Voice message",
        messageType: "voice" as any,
        attachmentUrl: result.url,
        attachmentName: file.name,
        attachmentType: file.type,
      });
    } catch {
      toast.error(pickLang(language, { ku: "هەڵە لە ناردنی دەنگ", en: "Error sending voice message", ar: "خطأ في إرسال الرسالة الصوتية", zh: "发送语音出错" }));
    }
    setIsUploading(false);
  };

  const formatTime = (date: any) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    } else if (days === 1) {
      return pickLang(language, { ku: "دوێنێ", en: "Yesterday", ar: "أمس", zh: "昨天" });
    } else if (days < 7) {
      return d.toLocaleDateString("ku-IQ", { weekday: "short" });
    }
    return d.toLocaleDateString("ku-IQ", { month: "short", day: "numeric" });
  };

  const renderMessageContent = (msg: any) => {
    const isStaff = msg.senderType === "staff";

    return (
      <div>
        {/* Image attachment */}
        {msg.messageType === "image" && msg.attachmentUrl && (
          <div className="mb-2">
            <img
              src={msg.attachmentUrl}
              alt={msg.attachmentName || "image"}
              className="max-w-[240px] rounded-lg cursor-pointer hover:opacity-90 transition"
              onClick={() => window.open(msg.attachmentUrl, "_blank")}
            />
          </div>
        )}

        {/* File attachment */}
        {msg.messageType === "file" && msg.attachmentUrl && (
          <a
            href={msg.attachmentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-2 mb-2 p-2 rounded-lg transition",
              isStaff ? "bg-blue-500/20 hover:bg-blue-500/30" : "bg-gray-100 hover:bg-gray-200"
            )}
          >
            <FileText className="w-5 h-5 shrink-0" />
            <span className="text-sm truncate">{msg.attachmentName || "File"}</span>
            <Download className="w-4 h-4 shrink-0 ms-auto" />
          </a>
        )}

        {/* Voice message */}
        {msg.messageType === "voice" && msg.attachmentUrl && (
          <div className="mb-1">
            <audio controls className="max-w-[240px] h-8" preload="metadata">
              <source src={msg.attachmentUrl} type={msg.attachmentType || "audio/webm"} />
            </audio>
          </div>
        )}

        {/* Text content */}
        {msg.content && msg.messageType === "text" && (
          <p className="whitespace-pre-wrap">{msg.content}</p>
        )}

        {/* Time + read status */}
        <div
          className={cn(
            "flex items-center gap-1 mt-1 text-xs",
            isStaff ? "text-blue-100" : "text-gray-400"
          )}
        >
          <Clock className="w-3 h-3" />
          {new Date(msg.createdAt).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })}
          {isStaff &&
            (msg.isRead ? (
              <CheckCheck className="w-3 h-3 ms-1" />
            ) : (
              <Circle className="w-2 h-2 ms-1 fill-current" />
            ))}
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-120px)] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{pickLang(language, { ku: "پەیامەکانی کڕیارەکان", en: "Customer Messages", ar: "رسائل العملاء", zh: "客户消息" })}</h1>
              <p className="text-blue-100">{pickLang(language, { ku: "وەڵامدانەوە بە کڕیارەکان", en: "Reply to customers", ar: "الرد على العملاء", zh: "回复客户" })}</p>
            </div>
            {chats && (
              <Badge className="ms-auto bg-white/20 text-white border-0 text-base px-3 py-1">
                {chats.filter((c: any) => c.unreadByStaff > 0).length} {pickLang(language, { ku: "نەخوێندراوە", en: "unread", ar: "غير مقروءة", zh: "未读" })}
              </Badge>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex bg-white dark:bg-slate-900 rounded-b-xl shadow-sm overflow-hidden border border-t-0">
          {/* Conversations List */}
          <div
            className={cn(
              "w-full md:w-80 border-e flex flex-col",
              selectedChatId ? "hidden md:flex" : "flex"
            )}
          >
            {/* Search */}
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder={pickLang(language, { ku: "گەڕان...", en: "Search...", ar: "بحث...", zh: "搜索..." })}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Chat list */}
            <div className="flex-1 overflow-y-auto">
              {loadingChats ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse flex items-center gap-3">
                      <div className="w-12 h-12 bg-gray-200 rounded-full" />
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
                        <div className="h-3 bg-gray-200 rounded w-32" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : !filteredChats?.length ? (
                <div className="p-8 text-center text-gray-500">
                  <Inbox className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>{pickLang(language, { ku: "هیچ گفتوگۆیەک نییە", en: "No conversations", ar: "لا توجد محادثات", zh: "暂无会话" })}</p>
                </div>
              ) : (
                filteredChats.map((chat: any) => (
                  <button
                    key={chat.id}
                    onClick={() => setSelectedChatId(chat.id)}
                    className={cn(
                      "w-full p-4 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors border-b",
                      selectedChatId === chat.id && "bg-blue-50 dark:bg-blue-900/20"
                    )}
                  >
                    <div className="relative">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {(chat.customerName || "?").charAt(0).toUpperCase()}
                      </div>
                      {chat.unreadByStaff > 0 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {chat.unreadByStaff}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 text-right min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {chat.lastMessageAt ? formatTime(chat.lastMessageAt) : ""}
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-white truncate">
                          {chat.customerName || pickLang(language, { ku: "نەناسراو", en: "Unknown", ar: "غير معروف", zh: "未知" })}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs px-1.5 py-0 mt-0.5">
                        {chat.customerCode || "-"}
                      </Badge>
                      <p className="text-sm text-gray-500 truncate mt-1">
                        {chat.totalMessages || 0} {pickLang(language, { ku: "پەیام", en: "messages", ar: "رسالة", zh: "条消息" })}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className={cn("flex-1 flex flex-col", selectedChatId ? "flex" : "hidden md:flex")}>
            {selectedChatId && selectedChat ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b flex items-center gap-3">
                  <button
                    onClick={() => setSelectedChatId(null)}
                    className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                    {(selectedChat.customerName || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{selectedChat.customerName}</h3>
                    <p className="text-sm text-gray-500">{selectedChat.customerCode}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      selectedChat.status === "open" && "border-green-300 text-green-700 bg-green-50",
                      selectedChat.status === "resolved" && "border-blue-300 text-blue-700 bg-blue-50",
                      selectedChat.status === "closed" && "border-gray-300 text-gray-700 bg-gray-50"
                    )}
                  >
                    {selectedChat.status === "open" ? pickLang(language, { ku: "کراوە", en: "Open", ar: "مفتوحة", zh: "进行中" }) : selectedChat.status === "resolved" ? pickLang(language, { ku: "چارەسەرکرا", en: "Resolved", ar: "تم الحل", zh: "已解决" }) : selectedChat.status}
                  </Badge>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-slate-950">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    </div>
                  ) : !messages?.length ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <div className="text-center">
                        <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>{pickLang(language, { ku: "هیچ پەیامێک نییە", en: "No messages", ar: "لا توجد رسائل", zh: "暂无消息" })}</p>
                      </div>
                    </div>
                  ) : (
                    messages.map((msg: any) => (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex",
                          msg.senderType === "staff" ? "justify-start" : "justify-end"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[70%] rounded-2xl px-4 py-2",
                            msg.senderType === "staff"
                              ? "bg-blue-600 text-white rounded-bl-md"
                              : "bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-br-md shadow-sm"
                          )}
                        >
                          {msg.senderType !== "staff" && msg.senderName && (
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                              {msg.senderName}
                            </p>
                          )}
                          {renderMessageContent(msg)}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Attachment preview */}
                {attachmentFile && (
                  <div className="px-4 pt-3 bg-white dark:bg-slate-900 border-t">
                    <div className="flex items-center gap-3 p-2 bg-gray-100 dark:bg-slate-800 rounded-lg">
                      {attachmentPreview ? (
                        <img src={attachmentPreview} alt="" className="w-16 h-16 rounded object-cover" />
                      ) : (
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-6 h-6 text-blue-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{attachmentFile.name}</p>
                        <p className="text-xs text-gray-500">
                          {(attachmentFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <button onClick={clearAttachment} className="p-1 hover:bg-gray-200 rounded">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Message Input */}
                <div className="p-4 border-t bg-white dark:bg-slate-900">
                  <div className="flex gap-2 items-end">
                    {/* Attachment buttons */}
                    <div className="flex gap-1">
                      <button
                        onClick={() => imageInputRef.current?.click()}
                        className="p-2.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition text-gray-500 hover:text-blue-600"
                        title={pickLang(language, { ku: "وێنە", en: "Image", ar: "صورة", zh: "图片" })}
                      >
                        <ImageIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition text-gray-500 hover:text-blue-600"
                        title={pickLang(language, { ku: "فایل", en: "File", ar: "ملف", zh: "文件" })}
                      >
                        <Paperclip className="w-5 h-5" />
                      </button>
                    </div>

                    {isRecording ? (
                      /* Recording UI */
                      <div className="flex-1 flex items-center gap-3">
                        <button
                          onClick={cancelRecording}
                          className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <div className="flex-1 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                          <span className="text-sm font-mono font-medium">{formattedDuration}</span>
                          <span className="text-xs text-gray-500">{pickLang(language, { ku: "تۆمارکردن...", en: "Recording...", ar: "جارٍ التسجيل...", zh: "录音中..." })}</span>
                        </div>
                        <Button
                          onClick={handleVoiceSend}
                          disabled={isUploading}
                          className="bg-blue-600 hover:bg-blue-700 h-10 w-10 p-0"
                        >
                          {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </Button>
                      </div>
                    ) : (
                      /* Normal input */
                      <>
                        <Input
                          placeholder={pickLang(language, { ku: "پەیامەکەت بنووسە...", en: "Type your message...", ar: "اكتب رسالتك...", zh: "输入消息..." })}
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                          className="flex-1"
                          dir="rtl"
                        />
                        {newMessage.trim() || attachmentFile ? (
                          <Button
                            onClick={handleSendMessage}
                            disabled={sendMessageMutation.isPending || isUploading}
                            className="bg-blue-600 hover:bg-blue-700 h-10 w-10 p-0"
                          >
                            {isUploading || sendMessageMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                          </Button>
                        ) : (
                          <button
                            onClick={async () => {
                              const ok = await startRecording();
                              if (!ok) toast.error(pickLang(language, { ku: "ڕێگەپێدانی مایکرۆفۆن نییە", en: "No microphone permission", ar: "لا يوجد إذن للميكروفون", zh: "无麦克风权限" }));
                            }}
                            className="p-2.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition text-gray-500 hover:text-blue-600"
                          >
                            <Mic className="w-5 h-5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* Hidden file inputs */}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e, "image")}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="*/*"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e, "file")}
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <h3 className="text-lg font-semibold mb-2">{pickLang(language, { ku: "گفتوگۆیەک هەڵبژێرە", en: "Select a conversation", ar: "اختر محادثة", zh: "选择一个会话" })}</h3>
                  <p>{pickLang(language, { ku: "کڕیارێک لە لیستەکە هەڵبژێرە بۆ بینینی پەیامەکان", en: "Select a customer from the list to view messages", ar: "اختر عميلاً من القائمة لعرض الرسائل", zh: "从列表中选择客户以查看消息" })}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
