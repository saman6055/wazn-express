import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/contexts/LanguageContext";
import { 
  MessageCircle, 
  Send, 
  User, 
  Clock,
  ArrowLeft,
  Search,
  CheckCheck,
  Circle
} from "lucide-react";

export default function CustomerMessages() {
    const { t } = useTranslation();
const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: conversations, isLoading: loadingConversations, refetch: refetchConversations } = 
    trpc.adminMessages.getConversations.useQuery();
  
  const { data: messages, isLoading: loadingMessages, refetch: refetchMessages } = 
    trpc.adminMessages.getMessages.useQuery(
      { customerId: selectedCustomerId! },
      { enabled: !!selectedCustomerId }
    );

  const sendReply = trpc.adminMessages.sendReply.useMutation({
    onSuccess: () => {
      setNewMessage("");
      refetchMessages();
      refetchConversations();
    },
  });

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedCustomerId) return;
    sendReply.mutate({
      customerId: selectedCustomerId,
      message: newMessage.trim(),
    });
  };

  const filteredConversations = conversations?.filter(conv => 
    conv.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.customerCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedConversation = conversations?.find(c => c.customerId === selectedCustomerId);

  const formatTime = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return d.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
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
              <h1 className="text-2xl font-bold">Customer Messages</h1>
              <p className="text-blue-100">Respond to customer inquiries</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex bg-white rounded-b-xl shadow-sm overflow-hidden border border-t-0">
          {/* Conversations List */}
          <div className={`w-full md:w-80 border-r flex flex-col ${selectedCustomerId ? 'hidden md:flex' : 'flex'}`}>
            {/* Search */}
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Conversations */}
            <div className="flex-1 overflow-y-auto">
              {loadingConversations ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gray-200 rounded-full" />
                        <div className="flex-1">
                          <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
                          <div className="h-3 bg-gray-200 rounded w-32" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredConversations?.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No conversations yet</p>
                </div>
              ) : (
                filteredConversations?.map(conv => (
                  <button
                    key={conv.customerId}
                    onClick={() => setSelectedCustomerId(conv.customerId)}
                    className={`w-full p-4 flex items-start gap-3 hover:bg-gray-50 transition-colors border-b ${
                      selectedCustomerId === conv.customerId ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="relative">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {conv.customerName.charAt(0).toUpperCase()}
                      </div>
                      {conv.unreadCount > 0 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {conv.unreadCount}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-900 truncate">
                          {conv.customerName}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatTime(conv.lastMessageAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-xs px-1.5 py-0">
                          {conv.customerCode}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500 truncate mt-1">
                        {conv.lastMessage}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className={`flex-1 flex flex-col ${selectedCustomerId ? 'flex' : 'hidden md:flex'}`}>
            {selectedCustomerId ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b flex items-center gap-3">
                  <button
                    onClick={() => setSelectedCustomerId(null)}
                    className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                    {selectedConversation?.customerName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold">{selectedConversation?.customerName}</h3>
                    <p className="text-sm text-gray-500">{selectedConversation?.customerCode}</p>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
                    </div>
                  ) : messages?.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <div className="text-center">
                        <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No messages yet</p>
                      </div>
                    </div>
                  ) : (
                    messages?.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.senderType === 'admin' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                            msg.senderType === 'admin'
                              ? 'bg-blue-600 text-white rounded-br-md'
                              : 'bg-white text-gray-900 rounded-bl-md shadow-sm'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.message}</p>
                          <div className={`flex items-center gap-1 mt-1 text-xs ${
                            msg.senderType === 'admin' ? 'text-blue-100' : 'text-gray-400'
                          }`}>
                            <Clock className="w-3 h-3" />
                            {new Date(msg.createdAt).toLocaleTimeString('en-US', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                            {msg.senderType === 'admin' && (
                              msg.isRead ? (
                                <CheckCheck className="w-3 h-3 ms-1" />
                              ) : (
                                <Circle className="w-2 h-2 ms-1 fill-current" />
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Message Input */}
                <div className="p-4 border-t bg-white">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type your reply..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || sendReply.isPending}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <h3 className="text-lg font-semibold mb-2">Select a conversation</h3>
                  <p>Choose a customer from the list to view messages</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
