import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Species } from '../types/database';
import { colors } from '../lib/colors';
import { Ionicons } from '@expo/vector-icons';

export default function SpeciesSearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Species[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => search(query), 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const search = async (q: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('species_dim')
      .select('*')
      .or(`common_name.ilike.%${q}%,scientific_name.ilike.%${q}%`)
      .order('common_name')
      .limit(40);
    setResults((data as Species[]) ?? []);
    setLoading(false);
  };

  const select = (species: Species) => {
    router.back();
    router.setParams({ speciesId: species.species_id, speciesName: species.common_name ?? species.scientific_name });
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.neutral[400]} />
        <TextInput
          style={styles.input}
          placeholder="Search by name…"
          placeholderTextColor={colors.neutral[400]}
          value={query}
          onChangeText={setQuery}
          autoFocus
        />
        {loading && <ActivityIndicator size="small" color={colors.green[600]} />}
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.species_id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => select(item)}>
            <View style={styles.rowText}>
              <Text style={styles.commonName}>{item.common_name ?? item.scientific_name}</Text>
              <Text style={styles.sciName}>{item.scientific_name}</Text>
            </View>
            <View style={styles.badges}>
              {item.is_toxic_to_cats && (
                <View style={[styles.badge, styles.badgeDanger]}>
                  <Text style={styles.badgeText}>🐱 toxic</Text>
                </View>
              )}
              {item.is_toxic_to_dogs && (
                <View style={[styles.badge, styles.badgeDanger]}>
                  <Text style={styles.badgeText}>🐶 toxic</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          !loading && query.length > 0 ? (
            <Text style={styles.empty}>No species found for "{query}"</Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 14,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    gap: 8,
  },
  input: { flex: 1, fontSize: 16, color: colors.neutral[900], paddingVertical: 12 },
  row: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowText: { flex: 1 },
  commonName: { fontSize: 15, fontWeight: '600', color: colors.neutral[900] },
  sciName: { fontSize: 12, color: colors.neutral[400], marginTop: 2, fontStyle: 'italic' },
  badges: { flexDirection: 'row', gap: 4 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 20 },
  badgeDanger: { backgroundColor: '#fef2f2' },
  badgeText: { fontSize: 11, color: colors.danger },
  empty: { textAlign: 'center', color: colors.neutral[400], marginTop: 40 },
});
