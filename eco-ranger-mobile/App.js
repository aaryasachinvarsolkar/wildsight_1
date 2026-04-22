import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet, View, Text } from 'react-native';
import ScanScreen from './src/screens/ScanScreen';

export default function App() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.title}>WildSight Eco Ranger</Text>
        <Text style={styles.subtitle}>Field Validation Console</Text>
      </View>
      <ScanScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#020617' },
  header: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  title: { color: '#e2e8f0', fontWeight: '800', fontSize: 24 },
  subtitle: { color: '#86efac', marginTop: 2, fontSize: 12, letterSpacing: 1 },
});
