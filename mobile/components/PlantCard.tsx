import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Plant } from '../types/database';
import { colors } from '../lib/colors';

interface Props {
  plant: Plant;
  unitPreference: 'metric' | 'imperial';
}

const EVENT_EMOJI: Record<string, string> = {
  watered: '💧',
  fertilized: '🌱',
  replanted: '🪴',
  measured: '📏',
  health_issue: '🚨',
  noted: '📝',
};

export default function PlantCard({ plant, unitPreference }: Props) {
  const router = useRouter();
  const potSize = unitPreference === 'imperial' ? plant.pot_size_in : plant.pot_size_cm;
  const potUnit = unitPreference === 'imperial' ? 'in' : 'cm';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/plant/${plant.plant_id}`)}
      activeOpacity={0.85}
    >
      <View style={styles.iconCircle}>
        <Text style={styles.icon}>🌿</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.nickname}>{plant.nickname || plant.species?.common_name || 'Unnamed Plant'}</Text>
        {plant.species && (
          <Text style={styles.species}>{plant.species.common_name}</Text>
        )}
        <View style={styles.meta}>
          {plant.location_of_plant && (
            <View style={styles.tag}>
              <Ionicons name="location-outline" size={12} color={colors.neutral[600]} />
              <Text style={styles.tagText}>{plant.location_of_plant}</Text>
            </View>
          )}
          {potSize && (
            <View style={styles.tag}>
              <Ionicons name="ellipse-outline" size={12} color={colors.neutral[600]} />
              <Text style={styles.tagText}>{potSize}{potUnit} pot</Text>
            </View>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.neutral[400]} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.green[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: { fontSize: 24 },
  info: { flex: 1 },
  nickname: { fontSize: 16, fontWeight: '600', color: colors.neutral[900] },
  species: { fontSize: 13, color: colors.neutral[600], marginTop: 1 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.green[50], paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  tagText: { fontSize: 12, color: colors.neutral[600] },
});
