import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { Profile, UnitPreference } from '../../types/database';
import { colors } from '../../lib/colors';
import { requestNotificationPermission } from '../../lib/notifications';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
      if (data) setProfile(data as Profile);
      setLoading(false);
    });
  }, [user]);

  const toggleUnit = async () => {
    if (!profile) return;
    const next: UnitPreference = profile.unit_preference === 'imperial' ? 'metric' : 'imperial';
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ unit_preference: next }).eq('id', profile.id);
    setSaving(false);
    if (!error) setProfile({ ...profile, unit_preference: next });
  };

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    Alert.alert(
      granted ? 'Notifications enabled' : 'Permission denied',
      granted ? "You'll get a reminder when it's time to water your plants." : 'Enable notifications in your device Settings to get watering reminders.',
    );
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.green[600]} /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarEmoji}>🌿</Text>
        </View>
        <Text style={styles.name}>{profile?.full_name ?? user?.email}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      {/* Settings */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Preferences</Text>

        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Ionicons name="resize-outline" size={20} color={colors.green[600]} />
            <View>
              <Text style={styles.rowLabel}>Unit System</Text>
              <Text style={styles.rowSub}>{profile?.unit_preference === 'imperial' ? 'Imperial (in)' : 'Metric (cm)'}</Text>
            </View>
          </View>
          <Switch
            value={profile?.unit_preference === 'metric'}
            onValueChange={toggleUnit}
            disabled={saving}
            trackColor={{ false: colors.neutral[200], true: colors.green[400] }}
            thumbColor={colors.white}
          />
        </View>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.row} onPress={handleEnableNotifications}>
          <View style={styles.rowLeft}>
            <Ionicons name="notifications-outline" size={20} color={colors.blue[600]} />
            <View>
              <Text style={styles.rowLabel}>Watering Reminders</Text>
              <Text style={styles.rowSub}>Get notified when plants need water</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.neutral[400]} />
        </TouchableOpacity>
      </View>

      {/* Account */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account</Text>
        <TouchableOpacity style={styles.row} onPress={handleSignOut}>
          <View style={styles.rowLeft}>
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text style={[styles.rowLabel, { color: colors.danger }]}>Sign Out</Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  avatarSection: { alignItems: 'center', marginBottom: 28 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.green[100], alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarEmoji: { fontSize: 40 },
  name: { fontSize: 20, fontWeight: '700', color: colors.neutral[900] },
  email: { fontSize: 14, color: colors.neutral[400], marginTop: 2 },
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  cardTitle: { fontSize: 12, fontWeight: '700', color: colors.neutral[400], textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '500', color: colors.neutral[900] },
  rowSub: { fontSize: 12, color: colors.neutral[400], marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.neutral[100], marginVertical: 4 },
});
