import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
  Modal,
  Image,
  ScrollView
} from "react-native";

import { LinearGradient } from "expo-linear-gradient";
import { Feather, MaterialIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import axios from "axios";

/* ?? BACKEND */
const API_URL = "http://192.168.43.124:5000/api/parse";

export default function HomeScreen({ navigation }) {
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [videoData, setVideoData] = useState(null);

  /* ?? AUTO-PASTE */
  useEffect(() => {
    (async () => {
      const text = await Clipboard.getStringAsync();
      if (!link && /^https?:\/\//i.test(text)) {
        setLink(text.trim());
      }
    })();
  }, []);

  /* ?? SEND LINK TO BACKEND */
  const handleResolve = async () => {
    if (!link) {
      Alert.alert("Paste a link first");
      return;
    }

    try {
      setLoading(true);
      const res = await axios.post(API_URL, { link });

      if (!res.data?.formats?.length) {
        Alert.alert("No media found");
        return;
      }

      setVideoData(res.data);
      setModalVisible(true);
    } catch (e) {
      Alert.alert("Backend error", "Check server connection");
    } finally {
      setLoading(false);
    }
  };

  /* ?? DOWNLOAD VIDEO */
  const startDownload = async (format) => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required");
        return;
      }

      const fileUri =
        FileSystem.documentDirectory +
        `tokmora_${Date.now()}.${format.ext || "mp4"}`;

      setModalVisible(false);
      Alert.alert("Downloading", "Please wait...");

      // Download actual video file
      const result = await FileSystem.downloadAsync(format.url, fileUri);

      // Save to Gallery
      const asset = await MediaLibrary.createAssetAsync(result.uri);
      await MediaLibrary.createAlbumAsync("Tokmora", asset, false);

      Alert.alert("Download complete", "Saved to Gallery ??");
    } catch (e) {
      console.error(e);
      Alert.alert("Download failed");
    }
  };

  /* ?? MANUAL PASTE */
  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (/^https?:\/\//i.test(text)) setLink(text.trim());
    else Alert.alert("Clipboard has no link");
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ?? TOP BAR */}
      <View style={styles.topBar}>
        <Text style={styles.brand}>Tokmora</Text>
         <TouchableOpacity onPress={() => navigation.navigate("Downloads")}>
        <Feather name="download" size={26} color="#4f46e5" />
        </TouchableOpacity>
      </View>

      {/* ?? HEADER */}
      <LinearGradient colors={["#4f46e5", "#6366f1"]} style={styles.header}>
        <Text style={styles.headerTitle}>MediaSaver</Text>
        <Text style={styles.headerSub}>
          Paste link • Choose quality • Download
        </Text>
      </LinearGradient>

      {/* ?? INPUT */}
      <View style={styles.card}>
        <Text style={styles.label}>Paste link</Text>

        <View style={styles.inputRow}>
          <TextInput
            placeholder="https://any-website.com/video"
            placeholderTextColor="#9ca3af"
            value={link}
            onChangeText={setLink}
            autoCapitalize="none"
            style={styles.input}
          />
          <TouchableOpacity onPress={handlePaste}>
            <Feather name="clipboard" size={18} color="#4f46e5" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.resolveBtn}
          onPress={handleResolve}
          disabled={loading}
        >
          <Text style={styles.resolveText}>
            {loading ? "Checking..." : "Continue"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ? ACTIONS */}
      <View style={styles.actions}>
        <ActionCard
          icon="message-circle"
          title="Status Saver"
          onPress={() => navigation.navigate("Saver")}
        />
        <ActionCard
          icon="download-cloud"
          title="Downloads"
          onPress={() => navigation.navigate("Downloads")}
        />
        <ActionCard
          icon="image"
          title="Gallery"
          onPress={() => Alert.alert("Coming soon")}
        />
      </View>

      {/* ?? MODAL */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView>
              <Image
                source={{ uri: videoData?.thumbnail }}
                style={styles.thumbnail}
              />
              <Text style={styles.videoTitle}>{videoData?.title}</Text>

              {videoData?.formats.map((f, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.qualityBtn}
                  onPress={() => startDownload(f)}
                >
                  <Text style={styles.qualityText}>{f.quality}</Text>
                  <Text style={styles.sizeText}>{f.size}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setModalVisible(false)}
            >
              <Text style={{ color: "#ef4444", fontWeight: "600" }}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ?? ACTION CARD */
function ActionCard({ icon, title, onPress }) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress}>
      <Feather name={icon} size={22} color="#4f46e5" />
      <Text style={styles.actionText}>{title}</Text>
    </TouchableOpacity>
  );
}

/* ?? STYLES */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },

  topBar: {
    backgroundColor: "#fff",
    padding: 16,
    marginTop: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb"
  },
  brand: { fontSize: 20, fontWeight: "700" },

  header: {
    padding: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24
  },
  headerTitle: { color: "#fff", fontSize: 26, fontWeight: "bold" },
  headerSub: { color: "#e0e7ff", marginTop: 4 },

  card: {
    backgroundColor: "#fff",
    margin: 16,
    padding: 16,
    borderRadius: 16
  },

  label: { fontWeight: "600", marginBottom: 8 },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12
  },
  input: { flex: 1, height: 48 },

  resolveBtn: {
    marginTop: 16,
    backgroundColor: "#4f46e5",
    padding: 14,
    borderRadius: 14,
    alignItems: "center"
  },
  resolveText: { color: "#fff", fontWeight: "600" },

  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16
  },
  actionCard: {
    backgroundColor: "#fff",
    width: "31%",
    padding: 14,
    borderRadius: 16,
    alignItems: "center"
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 16
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    maxHeight: "80%"
  },
  thumbnail: { height: 180, borderRadius: 12 },
  videoTitle: { fontWeight: "700", marginVertical: 12 },

  qualityBtn: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    marginBottom: 10,
    alignItems: "center"
  },
  qualityText: { fontWeight: "600" },
  sizeText: { fontSize: 12, color: "#6b7280" },

  closeBtn: { marginTop: 8, alignItems: "center" }
});