import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { colors } from '../../../lib/colors';
import { OriginType, Plant } from '../../../types/database';

const ORIGIN_OPTIONS: { label: string; value: OriginType }[] = [
  { label: 'Purchased / Gifted', value: 'purchased_gifted' },
  { label: 'Propagated', value: 'propagated' },
  { label: 'Grown from Seed', value: 'seed' },
];

export default function EditPlantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [plant, setPlant] = useState<Plant | null>(null);
  const [nickname, setNickname] = useState('');
  const [location, setLocation] = useState('');
  const [potSize, setPotSize] = useState('');
  const [origin, setOrigin] = useState<OriginType>('purchased_gifted');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('my_plants_dim').select('*').eq('plant_id', id).single().then(({ data }) => {
      if (data) {
        const p = data as Plant;
        setPlant(p);
        setNickname(p.nickname ?? '');
        setLocation(p.location_of_plant ?? '');
        setPotSize(p.pot_size_in != null ? String(p.pot_size_in) : '');
        setOrigin(p.origin_type ?? 'purchased_gifted');
      }
      setLoading(false);
    });
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from('my_plants_dim').update({
      nickname: nickname.trim() || null,
      location_of_plant: location.trim() || null,
      pot_size_in: potSize ? parseFloat(potSize) : null,
      origin_type: origin,
    }).eq('plant_id', id);
    setSaving(false);
    if (error) Alert.alert('Error', error.message);
    else router.back();
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.green[600]} /></View>;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Nickname</Text>
        <TextInput style={styles.input} value={nickname} onChangeText={setNickname} placeholder="Optional nickname" placeholderTextColor={colors.neutral[400]} />

        <Text style={styles.label}>Location</Text>
        <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="e.g. Kitchen" placeholderTextColor={colors.neutral[400]} />

        <Text style={styles.label}>Pot size (inches)</Text>
        <TextInput style={styles.input} value={potSize} onChangeText={setPotSize} keyboardType="decimal-pad" placeholder="e.g. 6" placeholderTextColor={colors.neutral[400]} />

        <Text style={styles.label}>Origin</Text>
        <View style={styles.originRow}>
          {ORIGIN_OPTIONS.map((opt) => (
            <TouchableOpacity key={opt.value} style={[styles.chip, origin === opt.value && styles.chipActive]} onPress={() => setOrigin(opt.value)}>
              <Text style={[styles.chipText, origin === opt.value && styles.chipTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={[styles.saveButton, saving && styles.disabled]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>Save Changes</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: colors.neutral[600], textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: colors.white, borderRadius: 12, padding: 14, fontSize: 16, color: colors.neutral[900], borderWidth: 1, borderColor: colors.neutral[200] },
  originRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.neutral[200] },
  chipActive: { backgroundColor: colors.green[600], borderColor: colors.green[600] },
  chipText: { fontSize: 14, color: colors.neutral[700] },
  chipTextActive: { color: colors.white, fontWeight: '600' },
  saveButton: { backgroundColor: colors.green[600], borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 32, marginBottom: 20 },
  disabled: { opacity: 0.6 },
  saveText: { color: colors.white, fontSize: 16, fontWeight: '600' },
});
