import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/services/api';

const SERVICE_NAMES: { [key: string]: string } = {
  gas_delivery: 'Gas Delivery',
  towing: 'Towing',
  tire_repair: 'Tire Repair',
  mechanic: 'Mobile Mechanic',
  car_wash: 'Car Wash',
};

export default function AdminSettingsScreen() {
  const [pricingConfigs, setPricingConfigs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [editedConfig, setEditedConfig] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadPricingConfigs();
  }, []);

  const loadPricingConfigs = async () => {
    try {
      const data = await api.getPricingConfigs();
      setPricingConfigs(data);
    } catch (error) {
      console.error('Error loading pricing configs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectService = (serviceType: string) => {
    const config = pricingConfigs.find((c) => c.service_type === serviceType);
    setSelectedService(serviceType);
    setEditedConfig(config ? { ...config } : {
      service_type: serviceType,
      base_fee: 25,
      per_mile_fee: 0,
      surge_multiplier: 1.0,
      platform_fee_percent: 0.15,
      gas_max_gallons: 10,
      enabled: true,
    });
  };

  const handleSaveConfig = async () => {
    if (!editedConfig) return;

    setIsSaving(true);
    try {
      await api.updatePricingConfig(editedConfig);
      Alert.alert('Success', 'Pricing configuration saved');
      loadPricingConfigs();
      setSelectedService(null);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Could not save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  if (selectedService && editedConfig) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelectedService(null)}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>{SERVICE_NAMES[selectedService]}</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView style={styles.editContent}>
          {/* Enable/Disable */}
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Service Enabled</Text>
              <Text style={styles.settingDescription}>Allow customers to request this service</Text>
            </View>
            <Switch
              value={editedConfig.enabled}
              onValueChange={(value) => setEditedConfig({ ...editedConfig, enabled: value })}
              trackColor={{ false: '#333', true: '#34C759' }}
              thumbColor="#fff"
            />
          </View>

          {/* Base Fee */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Base Fee ($)</Text>
            <TextInput
              style={styles.input}
              value={String(editedConfig.base_fee)}
              onChangeText={(value) => setEditedConfig({ ...editedConfig, base_fee: parseFloat(value) || 0 })}
              keyboardType="decimal-pad"
              placeholderTextColor="#666"
            />
          </View>

          {/* Per Mile Fee */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Per Mile Fee ($)</Text>
            <TextInput
              style={styles.input}
              value={String(editedConfig.per_mile_fee)}
              onChangeText={(value) => setEditedConfig({ ...editedConfig, per_mile_fee: parseFloat(value) || 0 })}
              keyboardType="decimal-pad"
              placeholderTextColor="#666"
            />
          </View>

          {/* Surge Multiplier */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Surge Multiplier</Text>
            <TextInput
              style={styles.input}
              value={String(editedConfig.surge_multiplier)}
              onChangeText={(value) => setEditedConfig({ ...editedConfig, surge_multiplier: parseFloat(value) || 1 })}
              keyboardType="decimal-pad"
              placeholderTextColor="#666"
            />
            <Text style={styles.inputHint}>1.0 = normal pricing, 1.5 = 50% surge</Text>
          </View>

          {/* Platform Fee */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Platform Fee (%)</Text>
            <TextInput
              style={styles.input}
              value={String((editedConfig.platform_fee_percent * 100).toFixed(0))}
              onChangeText={(value) => setEditedConfig({ ...editedConfig, platform_fee_percent: (parseFloat(value) || 15) / 100 })}
              keyboardType="number-pad"
              placeholderTextColor="#666"
            />
          </View>

          {/* Gas Specific */}
          {selectedService === 'gas_delivery' && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Max Gallons Per Order</Text>
              <TextInput
                style={styles.input}
                value={String(editedConfig.gas_max_gallons)}
                onChangeText={(value) => setEditedConfig({ ...editedConfig, gas_max_gallons: parseInt(value) || 10 })}
                keyboardType="number-pad"
                placeholderTextColor="#666"
              />
            </View>
          )}

          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveConfig}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Configuration</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Pricing Section */}
        <Text style={styles.sectionTitle}>Pricing Configuration</Text>
        <View style={styles.serviceList}>
          {Object.entries(SERVICE_NAMES).map(([key, name]) => {
            const config = pricingConfigs.find((c) => c.service_type === key);
            return (
              <TouchableOpacity
                key={key}
                style={styles.serviceItem}
                onPress={() => handleSelectService(key)}
              >
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceName}>{name}</Text>
                  <Text style={styles.servicePrice}>
                    Base: ${config?.base_fee || 25} • Fee: {((config?.platform_fee_percent || 0.15) * 100).toFixed(0)}%
                  </Text>
                </View>
                <View style={styles.serviceStatus}>
                  <View style={[
                    styles.enabledDot,
                    config?.enabled !== false && styles.enabledDotActive,
                  ]} />
                  <Ionicons name="chevron-forward" size={20} color="#444" />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* System Settings */}
        <Text style={styles.sectionTitle}>System</Text>
        <View style={styles.menuGroup}>
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="notifications" size={22} color="#007AFF" />
            <Text style={styles.menuText}>Notifications</Text>
            <Ionicons name="chevron-forward" size={20} color="#444" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="shield-checkmark" size={22} color="#007AFF" />
            <Text style={styles.menuText}>Security Settings</Text>
            <Ionicons name="chevron-forward" size={20} color="#444" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="analytics" size={22} color="#007AFF" />
            <Text style={styles.menuText}>Export Reports</Text>
            <Ionicons name="chevron-forward" size={20} color="#444" />
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>Admin Dashboard v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  serviceList: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    color: '#fff',
  },
  servicePrice: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  serviceStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  enabledDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#666',
    marginRight: 8,
  },
  enabledDotActive: {
    backgroundColor: '#34C759',
  },
  menuGroup: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    marginLeft: 12,
  },
  version: {
    textAlign: 'center',
    color: '#444',
    fontSize: 13,
    marginTop: 40,
    marginBottom: 40,
  },
  // Edit screen styles
  editContent: {
    flex: 1,
    padding: 20,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  settingLabel: {
    fontSize: 16,
    color: '#fff',
  },
  settingDescription: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
  },
  inputHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
