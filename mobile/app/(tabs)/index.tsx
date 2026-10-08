import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { Plant, Profile } from '../../types/database';
import PlantCard from '../../components/PlantCard';
import { colors } from '../../lib/colors';

export default function PlantsScreen() {
  const { user } = useAuth();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    const [plantsRes, profileRes] = await Promise.all([
      supabase
        .from('my_plants_dim')
        .select('*, species:species_id(*)')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('active_start_date', { ascending: false }),
      supabase.from('profiles').select('*').eq('id', user.id).single(),
    ]);
    if (plantsRes.data) setPlants(plantsRes.data as Plant[]);
    if (profileRes.data) setProfile(profileRes.data as Profile);
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData().finally(() => setLoading(false));
    }, [user])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.green[600]} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={plants}
        keyExtractor={(item) => item.plant_id}
        renderItem={({ item }) => (
          <PlantCard plant={item} unitPreference={profile?.unit_preference ?? 'imperial'} />
        )}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green[600]} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🪴</Text>
            <Text style={styles.emptyTitle}>No plants yet</Text>
            <Text style={styles.emptySubtitle}>Tap the + tab to add your first plant.</Text>
          </View>
        }
        ListHeaderComponent={
          <Text style={styles.header}>
            {plants.length > 0 ? `${plants.length} plant${plants.length === 1 ? '' : 's'}` : ''}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  list: { padding: 16, paddingTop: 8 },
  header: { fontSize: 13, color: colors.neutral[400], marginBottom: 8, marginLeft: 4 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: colors.neutral[800] },
  emptySubtitle: { fontSize: 14, color: colors.neutral[400], marginTop: 8, textAlign: 'center' },
});
