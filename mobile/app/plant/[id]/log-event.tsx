import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image, ActionSheetIOS,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import { colors } from '../../../lib/colors';
import { pickAndUploadImage, takeAndUploadPhoto } from '../../../lib/storage';
import { scheduleWateringReminder } from '../../../lib/notifications';
import { EventType } from '../../../types/database';

const EVENT_OPTIONS: { type: EventType; emoji: string; label: string }[] = [
  { type: 'watered',      emoji: '💧', label: 'Watered' },
  { type: 'fertilized',   emoji: '🌱', label: 'Fertilized' },
  { type: 'replanted',    emoji: '🪴', label: 'Replanted' },
  { type: 'measured',     emoji: '📏', label: 'Measured' },
  { type: 'health_issue', emoji: '🚨', label: 'Health Issue' },
  { type: 'noted',        emoji: '📝', label: 'Note' },
];

export default function LogEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [eventType, setEventType] = useState<EventType>('watered');
  const [note, setNote] = useState('');
  const [height, setHeight] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handlePickPhoto = async () => {
    if (!user) return;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Choose from Library'], cancelButtonIndex: 0 },
        async (idx) => {
          if (idx === 1) await doPhoto('camera');
          if (idx === 2) await doPhoto('library');
        }
      );
    } else {
      await doPhoto('library');
    }
  };

  const doPhoto = async (source: 'camera' | 'library') => {
    if (!user) return;
    setImageUploading(true);
    try {
      const url = source === 'camera'
        ? await takeAndUploadPhoto(user.id)
        : await pickAndUploadImage(user.id);
      if (url) setImageUrl(url);
    } catch (e: any) {
      Alert.alert('Upload failed', e.message);
    } finally {
      setImageUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !id) return;
    setSaving(true);

    const { error } = await supabase.from('plant_facts').insert({
      plant_id: id,
      event_type: eventType,
      note_text: note.trim() || null,
      plant_height_in: (eventType === 'measured' && height) ? parseFloat(height) : null,
      image_url: imageUrl,
    });

    if (error) {
      setSaving(false);
      Alert.alert('Error', error.message);
      return;
    }

    // Schedule watering reminder if this was a watering event
    if (eventType === 'watered') {
      try {
        const { data: plantData } = await supabase
          .from('my_plants_dim')
          .select('nickname, species:species_id(typical_watering_frequency_days, common_name)')
          .eq('plant_id', id)
          .single();

        if (plantData) {
          const plant = plantData as any;
          const days = plant.species?.typical_watering_frequency_days ?? 7;
          const name = plant.nickname || plant.species?.common_name || 'Your plant';
          await scheduleWateringReminder(name, id, days);
        }
      } catch {
        // Non-fatal — notification scheduling failure shouldn't block save
      }
    }

    setSaving(false);
    router.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <Text style={styles.label}>Event Type</Text>
        <View style={styles.eventGrid}>
          {EVENT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.type}
              style={[styles.eventChip, eventType === opt.type && styles.eventChipActive]}
              onPress={() => setEventType(opt.type)}
            >
              <Text style={styles.eventEmoji}>{opt.emoji}</Text>
              <Text style={[styles.eventLabel, eventType === opt.type && styles.eventLabelActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {eventType === 'measured' && (
          <>
            <Text style={styles.label}>Height (inches)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 12.5"
              placeholderTextColor={colors.neutral[400]}
              keyboardType="decimal-pad"
              value={height}
              onChangeText={setHeight}
            />
          </>
        )}

        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Add any observations…"
          placeholderTextColor={colors.neutral[400]}
          multiline
          numberOfLines={4}
          value={note}
          onChangeText={setNote}
        />

        <Text style={styles.label}>Photo (optional)</Text>
        {imageUrl ? (
          <View>
            <Image source={{ uri: imageUrl }} style={styles.preview} resizeMode="cover" />
            <TouchableOpacity style={styles.removePhoto} onPress={() => setImageUrl(null)}>
              <Text style={styles.removePhotoText}>Remove photo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.photoPicker} onPress={handlePickPhoto} disabled={imageUploading}>
            {imageUploading ? (
              <ActivityIndicator color={colors.green[600]} />
            ) : (
              <>
                <Ionicons name="camera-outline" size={24} color={colors.green[600]} />
                <Text style={styles.photoPickerText}>Add Photo</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.saveButton, saving && styles.disabled]} onPress={handleSave} disabled={saving || imageUploading}>
          {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>Save Event</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20 },
  label: { fontSize: 13, fontWeight: '600', color: colors.neutral[600], textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  eventGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  eventChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.neutral[200] },
  eventChipActive: { backgroundColor: colors.green[600], borderColor: colors.green[600] },
  eventEmoji: { fontSize: 18 },
  eventLabel: { fontSize: 14, color: colors.neutral[700] },
  eventLabelActive: { color: colors.white, fontWeight: '600' },
  input: { backgroundColor: colors.white, borderRadius: 12, padding: 14, fontSize: 16, color: colors.neutral[900], borderWidth: 1, borderColor: colors.neutral[200] },
  multiline: { height: 100, textAlignVertical: 'top' },
  photoPicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.white, borderRadius: 12, padding: 18, borderWidth: 1.5, borderColor: colors.green[200], borderStyle: 'dashed' },
  photoPickerText: { fontSize: 16, color: colors.green[600], fontWeight: '500' },
  preview: { width: '100%', height: 200, borderRadius: 12 },
  removePhoto: { marginTop: 8, alignItems: 'center' },
  removePhotoText: { color: colors.danger, fontSize: 14 },
  saveButton: { backgroundColor: colors.green[600], borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 32, marginBottom: 20 },
  disabled: { opacity: 0.6 },
  saveText: { color: colors.white, fontSize: 16, fontWeight: '600' },
});
