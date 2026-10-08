import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity, Alert, RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { Plant, PlantFact, Profile, LIGHT_LABEL } from '../../types/database';
import CareEventItem from '../../components/CareEventItem';
import { colors } from '../../lib/colors';

export default function PlantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [plant, setPlant] = useState<Plant | null>(null);
  const [facts, setFacts] = useState<PlantFact[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    if (!id || !user) return;
    const [plantRes, factsRes, profileRes] = await Promise.all([
      supabase.from('my_plants_dim').select('*, species:species_id(*)').eq('plant_id', id).single(),
      supabase.from('plant_facts').select('*').eq('plant_id', id).order('event_timestamp', { ascending: false }),
      supabase.from('profiles').select('*').eq('id', user.id).single(),
    ]);
    if (plantRes.data) setPlant(plantRes.data as Plant);
    if (factsRes.data) setFacts(factsRes.data as PlantFact[]);
    if (profileRes.data) setProfile(profileRes.data as Profile);
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData().finally(() => setLoading(false));
    }, [id, user])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleArchive = () => {
    Alert.alert('Archive Plant', 'Mark this plant as inactive?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive', style: 'destructive', onPress: async () => {
          await supabase.from('my_plants_dim').update({ is_active: false, archived_date: new Date().toISOString().split('T')[0] }).eq('plant_id', id);
          router.back();
        },
      },
    ]);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.green[600]} /></View>;
  }

  if (!plant) {
    return <View style={styles.center}><Text>Plant not found.</Text></View>;
  }

  const unit = profile?.unit_preference ?? 'imperial';
  const potSize = unit === 'imperial' ? plant.pot_size_in : plant.pot_size_cm;
  const potUnit = unit === 'imperial' ? 'in' : 'cm';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green[600]} />}
    >
      {/* Hero card */}
      <View style={styles.hero}>
        <Text style={styles.heroEmoji}>🌿</Text>
        <Text style={styles.heroName}>{plant.nickname || plant.species?.common_name || 'Unnamed Plant'}</Text>
        {plant.species && (
          <Text style={styles.heroSpecies}>{plant.species.common_name} · {plant.species.scientific_name}</Text>
        )}
        <View style={styles.heroBadges}>
          {plant.location_of_plant && (
            <View style={styles.badge}>
              <Ionicons name="location-outline" size={13} color={colors.neutral[600]} />
              <Text style={styles.badgeText}>{plant.location_of_plant}</Text>
            </View>
          )}
          {potSize && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{potSize}{potUnit} pot</Text>
            </View>
          )}
          {plant.origin_type && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{plant.origin_type.replace('_', ' ')}</Text>
            </View>
          )}
        </View>
        {plant.species && (
          <View style={styles.toxicRow}>
            {plant.species.is_toxic_to_cats && <Text style={styles.toxic}>🐱 Toxic to cats</Text>}
            {plant.species.is_toxic_to_dogs && <Text style={styles.toxic}>🐶 Toxic to dogs</Text>}
          </View>
        )}
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryAction}
          onPress={() => router.push(`/plant/${id}/log-event`)}
        >
          <Ionicons name="add-circle" size={20} color={colors.white} />
          <Text style={styles.primaryActionText}>Log Event</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryAction} onPress={() => router.push(`/plant/${id}/edit`)}>
          <Ionicons name="pencil-outline" size={20} color={colors.green[600]} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryAction} onPress={handleArchive}>
          <Ionicons name="archive-outline" size={20} color={colors.neutral[600]} />
        </TouchableOpacity>
      </View>

      {/* Species tips */}
      {plant.species && (
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>Care Tips</Text>
          {plant.species.additional_tips && (
            <Text style={styles.tipsText}>{plant.species.additional_tips}</Text>
          )}
          {plant.species.water_days_baseline && (
            <Text style={styles.tipsText}>
              💧 Water every ~{plant.species.water_days_baseline} days
              {plant.species.water_days_min && plant.species.water_days_max
                ? ` (${plant.species.water_days_min}–${plant.species.water_days_max} depending on season)`
                : ''}
            </Text>
          )}
          {plant.species.water_notes && (
            <Text style={styles.tipsText}>{plant.species.water_notes}</Text>
          )}
          {plant.species.light && (
            <Text style={styles.tipsText}>☀️ {LIGHT_LABEL[plant.species.light]}</Text>
          )}
          {(plant.species.is_toxic_to_cats || plant.species.is_toxic_to_dogs) && (
            <Text style={styles.tipsText}>
              ⚠️ Toxic to {[
                plant.species.is_toxic_to_cats ? 'cats' : null,
                plant.species.is_toxic_to_dogs ? 'dogs' : null,
              ].filter(Boolean).join(' and ')}
            </Text>
          )}
          {plant.species.winter_adjustment && (
            <Text style={styles.tipsText}>❄️ {plant.species.winter_adjustment}</Text>
          )}
        </View>
      )}

      {/* Care history */}
      <Text style={styles.sectionTitle}>Care History ({facts.length})</Text>
      {facts.length === 0 ? (
        <Text style={styles.empty}>No events logged yet. Tap "Log Event" to start.</Text>
      ) : (
        facts.map((fact) => (
          <CareEventItem key={fact.fact_id} fact={fact} unitPreference={unit} />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  hero: { backgroundColor: colors.white, borderRadius: 20, padding: 20, alignItems: 'center', marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  heroEmoji: { fontSize: 56, marginBottom: 8 },
  heroName: { fontSize: 22, fontWeight: '700', color: colors.neutral[900], textAlign: 'center' },
  heroSpecies: { fontSize: 13, color: colors.neutral[500], marginTop: 4, textAlign: 'center', fontStyle: 'italic' },
  heroBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12, justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.green[50], paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 13, color: colors.neutral[700] },
  toxicRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
  toxic: { fontSize: 12, color: colors.danger },
  actions: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  primaryAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.green[600], borderRadius: 12, padding: 14 },
  primaryActionText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  secondaryAction: { backgroundColor: colors.white, borderRadius: 12, padding: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.neutral[200] },
  tipsCard: { backgroundColor: colors.green[50], borderRadius: 16, padding: 16, marginBottom: 14 },
  tipsTitle: { fontSize: 14, fontWeight: '700', color: colors.green[800], marginBottom: 8 },
  tipsText: { fontSize: 14, color: colors.neutral[700], marginBottom: 4, lineHeight: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.neutral[900], marginBottom: 12 },
  empty: { color: colors.neutral[400], textAlign: 'center', marginTop: 20 },
});
