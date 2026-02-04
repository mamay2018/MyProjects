import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { leadsAPI, aiAPI } from '../../../src/api';
import { COLORS, SPACING, FONTS } from '../../../src/constants/theme';
import { MessageLog } from '../../../src/types';
import { format } from 'date-fns';

export default function ConversationScreen() {
  const { id } = useLocalSearchParams();
  const flatListRef = useRef<FlatList>(null);
  
  const [messages, setMessages] = useState<MessageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [rewriting, setRewriting] = useState(false);

  useEffect(() => {
    loadMessages();
  }, [id]);

  const loadMessages = async () => {
    try {
      const response = await leadsAPI.getMessages(Number(id));
      setMessages(response.data);
    } catch (error) {
      console.log('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!messageText.trim()) return;

    setSending(true);
    try {
      await leadsAPI.sendMessage(Number(id), messageText.trim());
      setMessageText('');
      loadMessages();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Could not send message');
    } finally {
      setSending(false);
    }
  };

  const handleAIRewrite = async (tone: string) => {
    if (!messageText.trim()) {
      Alert.alert('Error', 'Please enter a message first');
      return;
    }

    setRewriting(true);
    try {
      const response = await aiAPI.rewrite(messageText, tone);
      setMessageText(response.data.rewritten);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Could not rewrite message');
    } finally {
      setRewriting(false);
    }
  };

  const renderMessage = ({ item }: { item: MessageLog }) => {
    const isOutbound = item.direction === 'OUTBOUND';
    
    return (
      <View style={[
        styles.messageContainer,
        isOutbound ? styles.outboundContainer : styles.inboundContainer
      ]}>
        <View style={[
          styles.messageBubble,
          isOutbound ? styles.outboundBubble : styles.inboundBubble
        ]}>
          <View style={styles.messageHeader}>
            <Ionicons 
              name={item.channel === 'SMS' ? 'chatbubble' : 'mail'} 
              size={12} 
              color={isOutbound ? 'rgba(255,255,255,0.7)' : COLORS.textSecondary} 
            />
            <Text style={[
              styles.channelText,
              isOutbound ? styles.outboundChannelText : styles.inboundChannelText
            ]}>
              {item.channel} {isOutbound ? 'Sent' : 'Received'}
            </Text>
          </View>
          {item.subject && (
            <Text style={[
              styles.subjectText,
              isOutbound && styles.outboundText
            ]}>
              Subject: {item.subject}
            </Text>
          )}
          <Text style={[
            styles.messageText,
            isOutbound && styles.outboundText
          ]}>
            {item.body}
          </Text>
          <Text style={[
            styles.timestamp,
            isOutbound ? styles.outboundTimestamp : styles.inboundTimestamp
          ]}>
            {format(new Date(item.timestamp), 'MMM d, h:mm a')}
          </Text>
          {item.status === 'FAILED' && (
            <View style={styles.errorBadge}>
              <Ionicons name="alert-circle" size={12} color={COLORS.error} />
              <Text style={styles.errorText}>Failed to send</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderMessage}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubbles-outline" size={48} color={COLORS.textLight} />
                <Text style={styles.emptyText}>No messages yet</Text>
                <Text style={styles.emptySubtext}>Send a message or assign a sequence</Text>
              </View>
            }
          />
        )}

        {/* AI Rewrite Buttons */}
        <View style={styles.aiContainer}>
          <Text style={styles.aiLabel}>AI Rewrite:</Text>
          {['Friendly', 'Professional', 'Urgent'].map((tone) => (
            <TouchableOpacity
              key={tone}
              style={styles.aiButton}
              onPress={() => handleAIRewrite(tone)}
              disabled={rewriting}
            >
              <Text style={styles.aiButtonText}>{tone}</Text>
            </TouchableOpacity>
          ))}
          {rewriting && <ActivityIndicator size="small" color={COLORS.primary} />}
        </View>

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            value={messageText}
            onChangeText={setMessageText}
            multiline
            placeholderTextColor={COLORS.textLight}
          />
          <TouchableOpacity 
            style={[styles.sendButton, !messageText.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!messageText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="send" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: SPACING.md,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  emptySubtext: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  messageContainer: {
    marginBottom: SPACING.md,
  },
  outboundContainer: {
    alignItems: 'flex-end',
  },
  inboundContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 16,
    padding: SPACING.md,
  },
  outboundBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  inboundBubble: {
    backgroundColor: COLORS.card,
    borderBottomLeftRadius: 4,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: SPACING.xs,
  },
  channelText: {
    fontSize: FONTS.sizes.xs,
  },
  outboundChannelText: {
    color: 'rgba(255,255,255,0.7)',
  },
  inboundChannelText: {
    color: COLORS.textSecondary,
  },
  subjectText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    marginBottom: SPACING.xs,
    color: COLORS.text,
  },
  messageText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text,
    lineHeight: 22,
  },
  outboundText: {
    color: '#FFFFFF',
  },
  timestamp: {
    fontSize: FONTS.sizes.xs,
    marginTop: SPACING.xs,
  },
  outboundTimestamp: {
    color: 'rgba(255,255,255,0.6)',
  },
  inboundTimestamp: {
    color: COLORS.textLight,
  },
  errorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: SPACING.xs,
  },
  errorText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.error,
  },
  aiContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  aiLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
  },
  aiButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: COLORS.primary + '15',
  },
  aiButtonText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primary,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: SPACING.md,
    gap: SPACING.sm,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    maxHeight: 100,
    fontSize: FONTS.sizes.md,
    color: COLORS.text,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.textLight,
  },
});
