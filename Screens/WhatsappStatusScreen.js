import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  Platform
} from "react-native";

import * as MediaLibrary from "expo-media-library";
import { Video } from "expo-av";
import { Feather } from "@expo/vector-icons";
import { BannerBottom, useInterstitial } from "../components/Ads";

const { width } = Dimensions.get("window");

export default function WhatsappStatusScreen() {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const interstitial = useInterstitial();

  useEffect(() => {
    if (Platform.OS !== "android") {
      Alert.alert(
        "Not Supported",
        "WhatsApp Status Saver works only on Android"
      );
      return;
    }
    loadStatuses();
  }, []);

  const loadStatuses = async () => {
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission required");
        return;
      }

      const assets = await MediaLibrary.getAssetsAsync({
        first: 400,
        mediaType: ["photo", "video"],
        sortBy: [["creationTime", false]]
      });

      // Filter for both WhatsApp and WhatsApp Business .Statuses
      const isWAStatus = (uri) =>
        uri.includes("Android/media/com.whatsapp/WhatsApp/Media/.Statuses") ||
        uri.includes("Android/media/com.whatsapp.w4b/WhatsApp Business/Media/.Statuses") ||
        (uri.includes("WhatsApp") && uri.includes(".Statuses"));

      const filtered = assets.assets.filter(a => isWAStatus(a.uri));

      setStatuses(filtered);
    } catch (e) {
      console.log(e);
      Alert.alert("Error", "Failed to load statuses");
    } finally {
      setLoading(false);
    }
  };

  const saveStatus = async (item) => {
    try {
      const asset = await MediaLibrary.createAssetAsync(item.uri);
      let album = await MediaLibrary.getAlbumAsync("Tokmora");
      if (!album) {
        album = await MediaLibrary.createAlbumAsync("Tokmora", asset, false);
      } else {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      }
      Alert.alert("Saved", "Status saved to Gallery");
      interstitial.show();
    } catch (e) {
      Alert.alert("Error", "Unable to save status");
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => saveStatus(item)}
    >
      {item.mediaType === "photo" ? (
        <Image source={{ uri: item.uri }} style={styles.media} />
      ) : (
        <Video
          source={{ uri: item.uri }}
          style={styles.media}
          resizeMode="cover"
          isMuted
          shouldPlay={false}
        />
      )}

      {item.mediaType === "video" && (
        <View style={styles.videoBadge}>
          <Feather name="video" size={14} color="#fff" />
        </View>
      )}

      <View style={styles.downloadBtn}>
        <Feather name="download" size={18} color="#fff" />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>WhatsApp Status</Text>

      {loading ? (
        <Text style={styles.info}>Loading statuses...</Text>
      ) : statuses.length === 0 ? (
        <Text style={styles.info}>
          No statuses found. View statuses on WhatsApp first.
        </Text>
      ) : (
        <FlatList
          data={statuses}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={2}
          showsVerticalScrollIndicator={false}
        />
      )}

      <BannerBottom />
    </View>
  );
}

/* ?? STYLES */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
    marginTop:30
  },
  header: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    padding: 16
  },
  info: {
    textAlign: "center",
    marginTop: 40,
    color: "#6b7280"
  },
  card: {
    width: width / 2,
    height: width / 2,
    padding: 6
  },
  media: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
    backgroundColor: "#e5e7eb"
  },
  downloadBtn: {
    position: "absolute",
    bottom: 14,
    right: 14,
    backgroundColor: "#4f46e5",
    padding: 8,
    borderRadius: 20,
    elevation: 4
  },
  videoBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 6,
    borderRadius: 14
  }
});