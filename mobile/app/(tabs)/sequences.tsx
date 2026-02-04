import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity,
  RefreshControl,
  Alert
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { sequencesAPI } from '../../src/api';
import { SequenceCard } from '../../src/components/SequenceCard';
import { Button } from '../../src/components/Button';
import { COLORS, SPACING, FONTS } from '../../src/constants/theme';
import { Sequence } from '../../src/types';

export default function SequencesScreen() {
  const router = useRouter();
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadSequences = async () => {
    try {
      const response = await sequencesAPI.getAll();
      setSequences(response.data);
    } catch (error) {
      console.log('Error loading sequences:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadSequences();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadSequences();
  };

  const handleDeleteSequence = async (id: number) => {
    Alert.alert(
      'Delete Sequence',
      'Are you sure you want to delete this sequence?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await sequencesAPI.delete(id);
              loadSequences();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Could not delete sequence');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Follow-up Sequences</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => router.push('/sequence/new')}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={sequences}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.cardContainer}>
            <SequenceCard
              sequence={item}
              onPress={() => router.push(`/sequence/${item.id}`)}
            />
            {!item.is_builtin && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteSequence(item.id)}
              >
                <Ionicons name="trash-outline" size={18} color={COLORS.error} />
              </TouchableOpacity>
            )}
          </View>
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="git-branch-outline" size={64} color={COLORS.textLight} />
            <Text style={styles.emptyText}>No sequences found</Text>
            <Text style={styles.emptySubtext}>Create your first sequence</Text>
          </View>
        }
        ListHeaderComponent={
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color={COLORS.info} />
            <Text style={styles.infoText}>
              Sequences automate follow-ups. Assign one to a lead to start the automation.
            </Text>
          </View>
        }
      />
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
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: SPACING.md,
  },
  cardContainer: {
    position: 'relative',
  },
  deleteButton: {
    position: 'absolute',
    bottom: SPACING.lg,
    right: SPACING.md,
    padding: SPACING.sm,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.info + '15',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  infoText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.text,
    lineHeight: 20,
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
  },
});
