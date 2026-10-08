import { supabase } from './supabase';
import * as ImagePicker from 'expo-image-picker';

export async function pickAndUploadImage(userId: string): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.7,
  });

  if (result.canceled) return null;
  const asset = result.assets[0];

  const ext = asset.uri.split('.').pop() ?? 'jpg';
  const fileName = `${userId}/${Date.now()}.${ext}`;
  const response = await fetch(asset.uri);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();

  const { error } = await supabase.storage
    .from('plant-images')
    .upload(fileName, arrayBuffer, { contentType: `image/${ext}`, upsert: false });

  if (error) throw error;

  const { data } = supabase.storage.from('plant-images').getPublicUrl(fileName);
  return data.publicUrl;
}

export async function takeAndUploadPhoto(userId: string): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.7,
  });

  if (result.canceled) return null;
  const asset = result.assets[0];

  const ext = 'jpg';
  const fileName = `${userId}/${Date.now()}.${ext}`;
  const response = await fetch(asset.uri);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();

  const { error } = await supabase.storage
    .from('plant-images')
    .upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: false });

  if (error) throw error;

  const { data } = supabase.storage.from('plant-images').getPublicUrl(fileName);
  return data.publicUrl;
}
