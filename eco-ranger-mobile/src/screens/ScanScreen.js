import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

import { analyzeScanImage } from '../services/api';

export default function ScanScreen() {
  const [scannedImageUri, setScannedImageUri] = useState(null);
  const [result, setResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const askCameraPermission = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Camera permission is required to scan species image.');
    }
  };

  const getLocation = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Location permission is required to attach scan coordinates.');
    }
    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      altitude: location.coords.altitude || null,
    };
  };

  const scanAndAnalyze = async () => {
    try {
      setAnalyzing(true);
      setResult(null);

      await askCameraPermission();
      const capture = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (capture.canceled || !capture.assets?.length) {
        setAnalyzing(false);
        return;
      }

      const imageUri = capture.assets[0].uri;
      setScannedImageUri(imageUri);

      const location = await getLocation();
      const response = await analyzeScanImage({
        imageUri,
        latitude: location.latitude,
        longitude: location.longitude,
        altitude: location.altitude,
        rangerId: 'ranger-001',
        rangerName: 'Sujit',
        notes: 'Auto-captured by Eco Ranger scan mode',
      });

      setResult(response);
      Alert.alert('Scan complete', 'Species analyzed and synced to web dashboard.');
    } catch (error) {
      Alert.alert('Scan failed', error?.message || 'Unable to analyze the scan.');
    } finally {
      setAnalyzing(false);
    }
  };

  const analysis = result?.analysis;
  const location = result?.location;
  const analysisSource = result?.analysis_source;
  const aiError = result?.gemini_error;
  const imageStorageError = result?.image_storage_error;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.headline}>Eco Ranger Scan</Text>
      <Text style={styles.subtitle}>First step: capture one species image. AI will identify and analyze health automatically.</Text>

      <TouchableOpacity style={styles.scanButton} onPress={scanAndAnalyze} disabled={analyzing}>
        <Text style={styles.scanButtonText}>{analyzing ? 'Analyzing...' : 'Scan Species Image'}</Text>
      </TouchableOpacity>

      {scannedImageUri && <Image source={{ uri: scannedImageUri }} style={styles.previewImage} />}

      {analysis && (
        <View style={styles.resultCard}>
          <Text style={styles.sectionTitle}>Scan Result</Text>

          <ResultRow label="Species Name" value={analysis.species_common_name} />
          <ResultRow label="Scientific Name" value={analysis.species_scientific_name} />
          <ResultRow label="Type" value={analysis.species_type} />
          <ResultRow label="Growth Stage" value={analysis.growth_stage} />
          <ResultRow label="Health Status" value={analysis.health_status} />
          <ResultRow label="Confidence" value={`${Math.round((analysis.confidence || 0) * 100)}%`} />

          <Text style={styles.analysisText}>{analysis.health_analysis}</Text>

          {analysis.ai_notes ? <Text style={styles.noteText}>AI notes: {analysis.ai_notes}</Text> : null}
          <Text style={analysisSource === 'gemini' ? styles.successText : styles.warningText}>
            AI status: {analysisSource === 'gemini' ? 'AI analysis complete' : 'Fallback analysis used'}
          </Text>
          {aiError ? <Text style={styles.warningText}>AI error: {String(aiError).replace(/gemini/gi, 'AI')}</Text> : null}
          {imageStorageError ? <Text style={styles.warningText}>Image storage: {imageStorageError}</Text> : null}

          <View style={styles.locationCard}>
            <Text style={styles.locationTitle}>Location</Text>
            <Text style={styles.locationText}>Lat: {location?.latitude?.toFixed?.(6) ?? location?.latitude}</Text>
            <Text style={styles.locationText}>Lon: {location?.longitude?.toFixed?.(6) ?? location?.longitude}</Text>
            {location?.altitude_meters !== null && location?.altitude_meters !== undefined && (
              <Text style={styles.locationText}>Altitude: {Math.round(location.altitude_meters)} m</Text>
            )}
          </View>

          <Text style={styles.syncedText}>Recorded to website dashboard (Eco Ranger web view).</Text>
        </View>
      )}
    </ScrollView>
  );
}

function ResultRow({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value || 'Unknown'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  headline: {
    fontSize: 24,
    fontWeight: '800',
    color: '#e2e8f0',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
  },
  scanButton: {
    marginTop: 6,
    backgroundColor: '#16a34a',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 14,
  },
  scanButtonText: {
    color: '#ecfeff',
    fontWeight: '800',
    fontSize: 15,
  },
  previewImage: {
    width: '100%',
    height: 240,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 2,
  },
  resultCard: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 14,
    backgroundColor: '#0f172a',
    padding: 12,
    gap: 8,
  },
  sectionTitle: {
    color: '#86efac',
    fontWeight: '800',
    fontSize: 16,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowLabel: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 12,
  },
  rowValue: {
    color: '#e2e8f0',
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'right',
    flex: 1,
  },
  analysisText: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  noteText: {
    color: '#f8fafc',
    fontSize: 12,
    lineHeight: 17,
    backgroundColor: '#1f2937',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  successText: {
    color: '#86efac',
    fontSize: 12,
    fontWeight: '700',
  },
  warningText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '700',
  },
  locationCard: {
    marginTop: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#164e63',
    backgroundColor: '#082f49',
    padding: 10,
  },
  locationTitle: {
    color: '#67e8f9',
    fontWeight: '700',
    marginBottom: 4,
  },
  locationText: {
    color: '#cffafe',
    fontSize: 12,
  },
  syncedText: {
    marginTop: 6,
    color: '#86efac',
    fontSize: 12,
    fontWeight: '600',
  },
});
