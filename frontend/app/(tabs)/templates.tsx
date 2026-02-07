import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { templateAPI } from '../../src/api';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { COLORS, SPACING, FONTS, SHADOWS, CHANNEL_LABELS } from '../../src/constants/theme';
import { Template, TemplateCategory } from '../../src/types';

const CATEGORIES: { value: TemplateCategory; label: string; icon: string }[] = [
  { value: 'SMS', label: 'SMS', icon: 'chatbubble' },
  { value: 'EMAIL', label: 'Email', icon: 'mail' },
  { value: 'PLATFORM', label: 'Platform', icon: 'copy' },
];

const TOKEN_HINTS = [
  { token: '{customer_name}', desc: 'Customer\'s name' },
  { token: '{pro_name}', desc: 'Your name' },
  { token: '{business_name}', desc: 'Your business name' },
  { token: '{booking_link}', desc: 'Public booking URL' },
  { token: '{appointment_time}', desc: 'Appointment date/time' },
];

export default function TemplatesScreen() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<TemplateCategory>('SMS');
  const [formSubject, setFormSubject] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);

  const loadData = async () => {
    try {
      const response = await templateAPI.getAll(selectedCategory || undefined);
      setTemplates(response.data);
    } catch (error) {
      console.log('Error loading templates:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [selectedCategory])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const openCreateModal = () => {
    setEditingTemplate(null);
    setFormName('');
    setFormCategory('SMS');
    setFormSubject('');
    setFormBody('');
    setFormIsDefault(false);
    setShowModal(true);
  };

  const openEditModal = (template: Template) => {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormCategory(template.category);
    setFormSubject(template.subject || '');
    setFormBody(template.body);
    setFormIsDefault(template.is_default);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName || !formBody) {
      Alert.alert('Error', 'Please enter a name and body');
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: formName,
        category: formCategory,
        subject: formCategory === 'EMAIL' ? formSubject : undefined,
        body: formBody,
        is_default: formIsDefault,
      };

      if (editingTemplate) {
        await templateAPI.update(editingTemplate.id, data);
      } else {
        await templateAPI.create(data);
      }

      setShowModal(false);
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Could not save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (template: Template) => {
    Alert.alert(
      'Delete Template',
      `Are you sure you want to delete "${template.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await templateAPI.delete(template.id);
              loadData();
            } catch (error) {
              Alert.alert('Error', 'Could not delete template');
            }
          },
        },
      ]
    );
  };

  const insertToken = (token: string) => {
    setFormBody(formBody + token);
  };

  const getCategoryIcon = (category: TemplateCategory) => {
    const cat = CATEGORIES.find(c => c.value === category);
    return cat?.icon || 'document';
  };

  const renderTemplate = ({ item }: { item: Template }) => (
    <TouchableOpacity 
      style={styles.templateCard}
      onPress={() => openEditModal(item)}
    >
      <View style={styles.templateHeader}>
        <View style={styles.templateIcon}>
          <Ionicons 
            name={getCategoryIcon(item.category) as any} 
            size={20} 
            color={COLORS.primary} 
          />
        </View>
        <View style={styles.templateInfo}>
          <Text style={styles.templateName}>{item.name}</Text>
          <Text style={styles.templateCategory}>{item.category}</Text>
        </View>
        {item.is_default && (
          <View style={styles.defaultBadge}>
            <Ionicons name="star" size={12} color={COLORS.warning} />
            <Text style={styles.defaultText}>Default</Text>
          </View>
        )}
      </View>
      <Text style={styles.templateBody} numberOfLines={2}>
        {item.body}
      </Text>
      <View style={styles.templateActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => openEditModal(item)}
        >
          <Ionicons name="pencil" size={16} color={COLORS.primary} />
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleDelete(item)}
        >
          <Ionicons name="trash" size={16} color={COLORS.error} />
          <Text style={[styles.actionText, { color: COLORS.error }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Templates</Text>
        <TouchableOpacity style={styles.addButton} onPress={openCreateModal}>
          <Ionicons name="add" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Category Filter */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[
            styles.filterChip,
            !selectedCategory && styles.filterChipActive
          ]}
          onPress={() => setSelectedCategory(null)}
        >
          <Text style={[
            styles.filterText,
            !selectedCategory && styles.filterTextActive
          ]}>All</Text>
        </TouchableOpacity>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.value}
            style={[
              styles.filterChip,
              selectedCategory === cat.value && styles.filterChipActive
            ]}
            onPress={() => setSelectedCategory(cat.value)}
          >
            <Ionicons 
              name={cat.icon as any} 
              size={16} 
              color={selectedCategory === cat.value ? '#FFF' : COLORS.textSecondary} 
            />
            <Text style={[
              styles.filterText,
              selectedCategory === cat.value && styles.filterTextActive
            ]}>{cat.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Templates List */}
      <FlatList
        data={templates}
        keyExtractor={(item) => item.id}
        renderItem={renderTemplate}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color={COLORS.textLight} />
            <Text style={styles.emptyText}>No templates</Text>
            <Text style={styles.emptySubtext}>Create your first template to speed up responses</Text>
          </View>
        }
      />

      {/* Create/Edit Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingTemplate ? 'Edit Template' : 'New Template'}
            </Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            <Input
              label="Template Name"
              placeholder="e.g., Initial SMS"
              value={formName}
              onChangeText={setFormName}
            />

            <Text style={styles.inputLabel}>Category</Text>
            <View style={styles.categoryRow}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.value}
                  style={[
                    styles.categoryChip,
                    formCategory === cat.value && styles.categoryChipActive
                  ]}
                  onPress={() => setFormCategory(cat.value)}
                >
                  <Ionicons 
                    name={cat.icon as any} 
                    size={18} 
                    color={formCategory === cat.value ? '#FFF' : COLORS.textSecondary} 
                  />
                  <Text style={[
                    styles.categoryText,
                    formCategory === cat.value && styles.categoryTextActive
                  ]}>{cat.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {formCategory === 'EMAIL' && (
              <Input
                label="Subject Line"
                placeholder="e.g., Thanks for contacting us!"
                value={formSubject}
                onChangeText={setFormSubject}
              />
            )}

            <Input
              label="Message Body"
              placeholder="Write your message..."
              value={formBody}
              onChangeText={setFormBody}
              multiline
              numberOfLines={6}
              style={styles.bodyInput}
            />

            {/* Token Hints */}
            <Text style={styles.tokenTitle}>Insert Variable:</Text>
            <View style={styles.tokenRow}>
              {TOKEN_HINTS.map(({ token }) => (
                <TouchableOpacity
                  key={token}
                  style={styles.tokenChip}
                  onPress={() => insertToken(token)}
                >
                  <Text style={styles.tokenText}>{token}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Default Toggle */}
            <TouchableOpacity
              style={styles.defaultToggle}
              onPress={() => setFormIsDefault(!formIsDefault)}
            >
              <View style={[
                styles.checkbox,
                formIsDefault && styles.checkboxActive
              ]}>
                {formIsDefault && (
                  <Ionicons name="checkmark" size={14} color="#FFF" />
                )}
              </View>
              <Text style={styles.defaultToggleText}>Set as default for {formCategory}</Text>
            </TouchableOpacity>

            <Button
              title={editingTemplate ? 'Save Changes' : 'Create Template'}
              onPress={handleSave}
              loading={saving}
              style={styles.saveButton}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  title: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    gap: SPACING.xs,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
  },
  filterText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: SPACING.md,
  },
  templateCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  templateIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateInfo: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  templateName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  templateCategory: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.warning + '20',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  defaultText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.warning,
    fontWeight: '500',
  },
  templateBody: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  templateActions: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  actionText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
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
    textAlign: 'center',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cancelText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.primary,
  },
  modalTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  modalContent: {
    padding: SPACING.md,
  },
  inputLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    marginTop: SPACING.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  categoryChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  categoryTextActive: {
    color: '#FFFFFF',
  },
  bodyInput: {
    height: 150,
    textAlignVertical: 'top',
  },
  tokenTitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  tokenRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  tokenChip: {
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 8,
  },
  tokenText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primary,
    fontFamily: 'monospace',
  },
  defaultToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  defaultToggleText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text,
  },
  saveButton: {
    marginTop: SPACING.md,
  },
});
