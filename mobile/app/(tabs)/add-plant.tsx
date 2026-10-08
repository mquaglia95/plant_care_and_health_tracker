import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { colors } from '../../lib/colors';
import { OriginType } from '../../types/database';

const ORIGIN_OPTIONS: { label: string; value: OriginType }[] = [
  { label: 'Purchased / Gifted', value: 'purchased_gifted' },
  { label: 'Propagated', value: 'propagated' },
  { label: 'Grown from Seed', value: 'seed' },
];

export default function AddPlantScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ speciesId?: string; speciesName?: string }>();

  const [speciesId, setSpeciesId] = useState<string | null>(null);
  const [speciesName, setSpeciesName] = useState<string>('');
  const [nickname, setNickname] = useState('');
  const [location, setLocation] = useState('');
  const [potSize, setPotSize] = useState('');
  const [origin, setOrigin] = useState<OriginType>('purchased_gifted');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (params.speciesId) {
      setSpeciesId(params.speciesId);
      setSpeciesName(params.speciesName ?? '');
    }
  }, [params.speciesId, params.speciesName]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from('my_plants_dim').insert({
      user_id: user.id,
      species_id: speciesId ?? null,
      nickname: nickname.trim() || null,
      location_of_plant: location.trim() || null,
      pot_size_in: potSize ? parseFloat(potSize) : null,
      origin_type: origin,
    });
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setNickname('');
      setLocation('');
      setPotSize('');
      setSpeciesId(null);
      setSpeciesName('');
      setOrigin('purchased_gifted');
      router.replace('/(tabs)');
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>Species</Text>
        <TouchableOpacity
          style={styles.speciesPicker}
          onPress={() => router.push('/species-search')}
        >
          <Ionicons name="leaf-outline" size={18} color={colors.green[600]} />
          <Text style={[styles.speciesText, !speciesName && styles.placeholder]}>
            {speciesName || 'Search for a species…'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.neutral[400]} />
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Nickname (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Big Bertha"
          placeholderTextColor={colors.neutral[400]}
          value={nickname}
          onChangeText={setNickname}
        />

        <Text style={styles.sectionLabel}>Location</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Kitchen windowsill"
          placeholderTextColor={colors.neutral[400]}
          value={location}
          onChangeText={setLocation}
        />

        <Text style={styles.sectionLabel}>Pot size (inches)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 6"
          placeholderTextColor={colors.neutral[400]}
          keyboardType="decimal-pad"
          value={potSize}
          onChangeText={setPotSize}
        />

        <Text style={styles.sectionLabel}>Origin</Text>
        <View style={styles.originRow}>
          {ORIGIN_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.originChip, origin === opt.value && styles.originChipActive]}
              onPress={() => setOrigin(opt.value)}
            >
              <Text style={[styles.originChipText, origin === opt.value && styles.originChipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.saveText}>Add Plant</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.neutral[600], textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  speciesPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    gap: 10,
  },
  speciesText: { flex: 1, fontSize: 16, color: colors.neutral[900] },
  placeholder: { color: colors.neutral[400] },
  input: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: colors.neutral[900],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  originRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  originChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  originChipActive: { backgroundColor: colors.green[600], borderColor: colors.green[600] },
  originChipText: { fontSize: 14, color: colors.neutral[700] },
  originChipTextActive: { color: colors.white, fontWeight: '600' },
  saveButton: {
    backgroundColor: colors.green[600],
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 20,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveText: { color: colors.white, fontSize: 16, fontWeight: '600' },
});
