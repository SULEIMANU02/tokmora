import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal
} from "react-native";
import * as MediaLibrary from "expo-media-library";
import { Video } from "expo-av";
import { Feather } from "@expo/vector-icons";

export default function DownloadsScreen() {
  const [downloads, setDownloads] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);

  useEffect(() => {
    loadDownloads();
  }, []);

  const loadDownloads = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required");
        return;
      }

      const album = await MediaLibrary.getAlbumAsync("Tokmora");
      if (!album) {
        setDownloads([]);
        return;
      }

      const assets = await MediaLibrary.getAssetsAsync({
        album,
        mediaType: "video",
        sortBy: [["creationTime", false]]
      });

      setDownloads(assets.assets);
    } catch (e) {
      Alert.alert("Error", "Unable to load downloads");
    }
  };

  const deleteFile = async (asset) => {
    Alert.alert(
      "Delete",
      "Are you sure you want to delete this file?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await MediaLibrary.deleteAssetsAsync([asset.id]);
            setDownloads(downloads.filter(d => d.id !== asset.id));
          }
        }
      ]
    );
  };

  const renderItem = ({ item }) => (
    <View style={styles.itemContainer}>
      <TouchableOpacity
        style={styles.thumbnailContainer}
        onPress={() => setSelectedVideo(item)}
      >
        <Image source={{ uri: item.uri }} style={styles.thumbnail} />
        <View style={styles.playBadge}>
          <Feather name="play" size={16} color="#fff" />
        </View>
      </TouchableOpacity>

      <View style={styles.infoContainer}>
        <Text style={styles.title} numberOfLines={1}>
          {item.filename}
        </Text>
        <Text style={styles.subInfo}>
          {(item.fileSize / 1024 / 1024).toFixed(2)} MB
        </Text>
      </View>

      <TouchableOpacity
        onPress={() => deleteFile(item)}
        style={styles.deleteBtn}
      >
        <Feather name="trash-2" size={22} color="#ef4444" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Downloads</Text>

      {downloads.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No downloaded videos yet</Text>
        </View>
      ) : (
        <FlatList
          data={downloads}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ? VIDEO PLAYER MODAL */}
      <Modal visible={!!selectedVideo} transparent animationType="slide">
        <View style={styles.playerOverlay}>
          <View style={styles.playerCard}>
            {selectedVideo && (
              <Video
                source={{ uri: selectedVideo.uri }}
                style={styles.video}
                useNativeControls
                resizeMode="contain"
                shouldPlay
              />
            )}
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setSelectedVideo(null)}
            >
              <Text style={{ color: "#ef4444", fontWeight: "600" }}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ?? STYLES */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb", marginTop:30 },
  header: {
    fontSize: 22,
    fontWeight: "700",
    padding: 16
  },
  itemContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
    elevation: 2
  },
  thumbnailContainer: {
    width: 100,
    height: 60,
    margin: 10
  },
  thumbnail: {
    width: "100%",
    height: "100%",
    borderRadius: 8
  },
  playBadge: {
    position: "absolute",
    top: 18,
    left: 40,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 4,
    borderRadius: 12
  },
  infoContainer: { flex: 1 },
  title: { fontWeight: "600" },
  subInfo: { fontSize: 12, color: "#6b7280" },
  deleteBtn: { padding: 12 },

  empty: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: "#6b7280" },

  playerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    padding: 16
  },
  playerCard: {
    backgroundColor: "#000",
    borderRadius: 12,
    overflow: "hidden"
  },
  video: {
    width: "100%",
    height: 250
  },
  closeBtn: {
    padding: 12,
    alignItems: "center",
    backgroundColor: "#fff"
  }
});