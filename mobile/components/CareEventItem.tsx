import { View, Text, Image, StyleSheet } from 'react-native';
import { PlantFact, UnitPreference } from '../types/database';
import { colors } from '../lib/colors';

const EVENT_META: Record<string, { emoji: string; label: string; color: string }> = {
  watered:      { emoji: '💧', label: 'Watered',     color: colors.blue[100] },
  fertilized:   { emoji: '🌱', label: 'Fertilized',  color: colors.green[100] },
  replanted:    { emoji: '🪴', label: 'Replanted',   color: colors.brown[100] },
  measured:     { emoji: '📏', label: 'Measured',    color: colors.neutral[100] },
  health_issue: { emoji: '🚨', label: 'Health Issue', color: '#fef2f2' },
  noted:        { emoji: '📝', label: 'Note',        color: colors.neutral[100] },
};

interface Props {
  fact: PlantFact;
  unitPreference: UnitPreference;
}

export default function CareEventItem({ fact, unitPreference }: Props) {
  const meta = EVENT_META[fact.event_type] ?? { emoji: '📋', label: fact.event_type, color: colors.neutral[100] };
  const date = new Date(fact.event_timestamp);
  const height = unitPreference === 'imperial' ? fact.plant_height_in : fact.plant_height_cm;
  const heightUnit = unitPreference === 'imperial' ? 'in' : 'cm';

  return (
    <View style={[styles.container, { backgroundColor: meta.color }]}>
      <View style={styles.header}>
        <Text style={styles.emoji}>{meta.emoji}</Text>
        <View style={styles.headerText}>
          <Text style={styles.label}>{meta.label}</Text>
          <Text style={styles.date}>
            {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            {' · '}
            {date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
      {height != null && (
        <Text style={styles.detail}>Height: {Number(height).toFixed(1)} {heightUnit}</Text>
      )}
      {fact.note_text && <Text style={styles.note}>{fact.note_text}</Text>}
      {fact.image_url && (
        <Image source={{ uri: fact.image_url }} style={styles.image} resizeMode="cover" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 12, padding: 14, marginBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emoji: { fontSize: 24 },
  headerText: { flex: 1 },
  label: { fontSize: 15, fontWeight: '600', color: colors.neutral[900] },
  date: { fontSize: 12, color: colors.neutral[600], marginTop: 2 },
  detail: { fontSize: 13, color: colors.neutral[700], marginTop: 8 },
  note: { fontSize: 14, color: colors.neutral[700], marginTop: 8, lineHeight: 20 },
  image: { width: '100%', height: 180, borderRadius: 8, marginTop: 10 },
});
