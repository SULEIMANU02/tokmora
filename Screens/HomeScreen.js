import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  Modal,
  Image,
  ScrollView,
  Platform,
  Linking,
  Animated,
  ActivityIndicator
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather, MaterialIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import axios from "axios";
import { BannerBottom, useInterstitial } from "../components/Ads";

const LOCAL_PARSE_BASE_URL = "https://tokmora2.vercel.app";
const WORKER_BASE_URL = (
  process.env.EXPO_PUBLIC_PARSE_API_BASE_URL || LOCAL_PARSE_BASE_URL
).replace(/\/+$/, "");
const MAIN_API_URL = WORKER_BASE_URL
  ? `${WORKER_BASE_URL}/api/parse/`
  : `${LOCAL_PARSE_BASE_URL}/api/parse/`;
const TIKTOK_API_URL = "https://aigdata.ng/parse/";
const TIKTOK_BASE_URL = "https://www.tikwm.com";

// Helper function to detect if URL is TikTok
const isTikTokUrl = (url) => {
  const lowerUrl = url.toLowerCase();
  return lowerUrl.includes('tiktok.com') || lowerUrl.includes('vt.tiktok.com');
};

// Helper function to get the appropriate API URL
const getApiUrl = (url) => {
  return isTikTokUrl(url) ? TIKTOK_API_URL : MAIN_API_URL;
};

// Helper function to fix relative URLs from TikTok API
const fixTikTokUrls = (data) => {
  if (!data || !data.success) return data;

  // Fix thumbnail URL
  if (data.thumbnail && !data.thumbnail.startsWith('http')) {
    data.thumbnail = TIKTOK_BASE_URL + data.thumbnail;
  }

  // Fix format URLs
  if (data.formats && Array.isArray(data.formats)) {
    data.formats = data.formats.map(format => {
      if (format.url && !format.url.startsWith('http')) {
        return {
          ...format,
          url: TIKTOK_BASE_URL + format.url
        };
      }
      return format;
    });
  }

  return data;
};

export default function HomeScreen({ navigation }) {
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [videoData, setVideoData] = useState(null);
  const [scaleAnim] = useState(new Animated.Value(1));
  const [showPasteBtn, setShowPasteBtn] = useState(false);
  const [clipboardContent, setClipboardContent] = useState("");
  const [autoDownloading, setAutoDownloading] = useState(false);

  const interstitial = useInterstitial();

  // Debug ad status
  useEffect(() => {
    console.log("Ad loaded status:", interstitial?.loaded);
  }, [interstitial?.loaded]);

  // Auto-check clipboard and auto-download
  useEffect(() => {
    checkClipboard();
    const interval = setInterval(checkClipboard, 2000);
    return () => clearInterval(interval);
  }, [link, autoDownloading]);

  const checkClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text && /^https?:\/\//i.test(text) && text !== link && !autoDownloading) {
        setClipboardContent(text.trim());
        setShowPasteBtn(true);
        
        // Auto-download if link is detected
        if (!loading && !modalVisible) {
          handleAutoDownload(text.trim());
        }
      } else if (text === link) {
        setShowPasteBtn(false);
      }
    } catch (e) {
      console.log("Clipboard check error:", e);
    }
  };

  const handleAutoDownload = async (clipboardLink) => {
    setAutoDownloading(true);
    setLink(clipboardLink);
    setShowPasteBtn(false);

    try {
      setLoading(true);
      
      // Choose API based on platform
      const apiUrl = getApiUrl(clipboardLink);
      console.log(`Using API: ${apiUrl} for link: ${clipboardLink}`);
      
      const res = await axios.post(apiUrl, { link: clipboardLink });

      console.log("Auto-download response:", res.data);

      // Fix TikTok URLs if needed
      const processedData = isTikTokUrl(clipboardLink) ? fixTikTokUrls(res.data) : res.data;

      if (!processedData?.formats?.length) {
        Alert.alert("No Media Found", "Couldn't find any downloadable media from this link");
        setAutoDownloading(false);
        return;
      }

      setVideoData(processedData);
      
      setModalVisible(true);
    } catch (e) {
      console.error("Auto-download error:", e);
      
      // Better error messaging
      let errorTitle = "Connection Error";
      let errorMessage = "Unable to process the link. Please check your internet connection and try again.";
      
      if (e.response?.status === 403 || e.response?.status === 451) {
        errorTitle = "Access Restricted";
        errorMessage = "This content cannot be downloaded due to platform restrictions or copyright policies.";
      } else if (e.response?.status === 404) {
        errorTitle = "Content Not Found";
        errorMessage = "The video may have been deleted or the link is incorrect.";
      } else if (e.response?.data?.message) {
        errorMessage = e.response.data.message;
      }
      
      Alert.alert(errorTitle, errorMessage);
    } finally {
      setLoading(false);
      setAutoDownloading(false);
    }
  };

  const handleAutoPaste = () => {
    setLink(clipboardContent);
    setShowPasteBtn(false);
  };

  const handleResolve = async () => {
    if (!link) {
      Alert.alert("Oops!", "Please paste a link first");
      return;
    }

    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true
      })
    ]).start();

    try {
      setLoading(true);
      
      // Choose API based on platform
      const apiUrl = getApiUrl(link);
      console.log(`Using API: ${apiUrl} for link: ${link}`);
      
      const res = await axios.post(apiUrl, { link });

      console.log("API response:", res.data);

      // Fix TikTok URLs if needed
      const processedData = isTikTokUrl(link) ? fixTikTokUrls(res.data) : res.data;

      if (!processedData?.formats?.length) {
        Alert.alert("No Media Found", "Couldn't find any downloadable media from this link");
        return;
      }

      setVideoData(processedData);
               console.log("Rendering format buttons");
      setModalVisible(true);
    } catch (e) {
      console.error("Resolve error:", e);
      
      // Better error messaging
      let errorTitle = "Connection Error";
      let errorMessage = "Unable to process the link. Please check your internet connection and try again.";
      
      if (e.response?.status === 403 || e.response?.status === 451) {
        errorTitle = "Access Restricted";
        errorMessage = "This content cannot be downloaded due to platform restrictions or copyright policies.";
      } else if (e.response?.status === 404) {
        errorTitle = "Content Not Found";
        errorMessage = "The video may have been deleted or the link is incorrect.";
      } else if (e.response?.status === 429) {
        errorTitle = "Too Many Requests";
        errorMessage = "Please wait a moment before trying again.";
      } else if (e.code === 'ECONNABORTED' || e.message.includes('timeout')) {
        errorTitle = "Request Timeout";
        errorMessage = "The request took too long. Please try again.";
      } else if (e.response?.data?.message) {
        errorMessage = e.response.data.message;
      }
      
      Alert.alert(errorTitle, errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const startDownload = async (format) => {
    // Close modal first
    setModalVisible(false);

    try {
      if (format.videoOnly) {
        Alert.alert(
          "Video Only Format",
          "This YouTube fallback format may download without audio.",
          [{ text: "OK" }]
        );
      }

      if (format.isExternal) {
        Alert.alert(
          "External Download",
          "This will open an external site to download the video.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Continue",
              onPress: () => Linking.openURL(format.url)
            }
          ]
        );
        return;
      }

      // Request permissions
      const { status, canAskAgain, accessPrivileges } = await MediaLibrary.requestPermissionsAsync();
      
      if (status !== "granted" && accessPrivileges !== "limited" && accessPrivileges !== "all") {
        Alert.alert("Permission Needed", "Please allow storage access to download media");
        return;
      }

      // Generate filename with proper extension
      const fileExt = format.ext || "mp4";
      const fileName = `tokmora_${Date.now()}.${fileExt}`;
      const fileUri = FileSystem.documentDirectory + fileName;

      console.log("📥 Starting download:", format.url);
      console.log("💾 Saving to:", fileUri);

      setDownloading(true);
      setDownloadProgress(0);

      const downloadResumable = FileSystem.createDownloadResumable(
        format.url,
        fileUri,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          setDownloadProgress(Math.round(progress * 100));
        }
      );

      const result = await downloadResumable.downloadAsync();

      if (!result || !result.uri) {
        throw new Error("Download failed - no file returned");
      }

      console.log("✅ Download complete:", result.uri);

      // Wait a bit for file system to sync
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check if file exists and get info
      const fileInfo = await FileSystem.getInfoAsync(result.uri);
      
      console.log("📄 File info:", {
        exists: fileInfo.exists,
        size: fileInfo.size,
        uri: fileInfo.uri
      });

      if (!fileInfo.exists) {
        throw new Error("Downloaded file not found");
      }

      // More reasonable file size check (100 bytes minimum)
      if (fileInfo.size < 100) {
        throw new Error("Downloaded file appears to be empty");
      }

      console.log("💾 Saving to gallery...");

      // Create asset with the downloaded file
      const asset = await MediaLibrary.createAssetAsync(result.uri);
      
      console.log("✅ Asset created:", asset.id);

      // Add to Tokmora album
      let album = await MediaLibrary.getAlbumAsync("Tokmora");
      if (!album) {
        console.log("📁 Creating Tokmora album...");
        await MediaLibrary.createAlbumAsync("Tokmora", asset, false);
      } else {
        console.log("📁 Adding to existing Tokmora album...");
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      }

      setDownloading(false);
      setDownloadProgress(0);
      
      // Show success message
      Alert.alert("Success! ✓", "Media saved to your Tokmora folder");

      // Show ad AFTER successful download
      console.log("Attempting to show ad, loaded status:", interstitial?.loaded);
      if (interstitial && interstitial.loaded) {
        console.log("Ad is loaded, showing now...");
        try {
          await interstitial.show();
          console.log("Ad shown successfully");
        } catch (error) {
          console.log("Error showing ad:", error);
        }
      } else {
        console.log("Ad not loaded yet");
      }
      
    } catch (e) {
      console.error("❌ Download error:", e);
      console.error("Error details:", {
        message: e.message,
        stack: e.stack
      });
      
      setDownloading(false);
      setDownloadProgress(0);
      
      let errorMessage = "The download failed. Please try again.";
      
      if (e.message.includes("not found")) {
        errorMessage = "Could not save the file. Please check storage permissions.";
      } else if (e.message.includes("empty")) {
        errorMessage = "The downloaded file is empty. The link may have expired.";
      } else if (e.message.includes("Network")) {
        errorMessage = "Network error. Please check your internet connection.";
      }
      
      Alert.alert("Download Failed", errorMessage);
    }
  };

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (/^https?:\/\//i.test(text)) {
      setLink(text.trim());
    } else {
      Alert.alert("No Link Found", "Your clipboard doesn't contain a valid link");
    }
  };

  const clearLink = () => {
    setLink("");
    setShowPasteBtn(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#4f46e5" />

      {/* Downloading Overlay */}
      {downloading && (
        <View style={styles.downloadingOverlay}>
          <View style={styles.downloadingCard}>
            <View style={styles.downloadingIconContainer}>
              <Feather name="download" size={40} color="#4f46e5" />
            </View>
            <Text style={styles.downloadingTitle}>Downloading...</Text>
            <Text style={styles.downloadingPercent}>{downloadProgress}%</Text>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${downloadProgress}%` }]} />
            </View>
            <Text style={styles.downloadingSubtext}>Please wait</Text>
          </View>
        </View>
      )}

      {/* Header with Gradient */}
      <LinearGradient colors={["#4f46e5", "#6366f1", "#7c3aed"]} style={styles.headerGradient}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.brand}>Tokmora</Text>
            <Text style={styles.brandSub}>Video Saver</Text>
          </View>
        </View>

        <View style={styles.heroSection}>
          <View style={styles.iconCircle}>
            <Feather name="download-cloud" size={32} color="#fff" />
          </View>
          <Text style={styles.heroTitle}>Save Videos</Text>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Auto-Paste Banner */}
        {showPasteBtn && (
          <TouchableOpacity
            style={styles.autoPasteBanner}
            onPress={handleAutoPaste}
          >
            <View style={styles.autoPasteContent}>
              <Feather name="clipboard" size={18} color="#4f46e5" />
              <Text style={styles.autoPasteText}>Link detected in clipboard</Text>
            </View>
            <Text style={styles.autoPasteBtn}>Paste</Text>
          </TouchableOpacity>
        )}

        {/* Input Card */}
        <View style={styles.inputCard}>
          <View style={styles.inputHeader}>
            <Feather name="link" size={18} color="#4f46e5" />
            <Text style={styles.inputLabel}>Paste your link here</Text>
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <TextInput
                placeholder="https://..."
                placeholderTextColor="#9ca3af"
                value={link}
                onChangeText={setLink}
                autoCapitalize="none"
                style={styles.input}
              />

              {link ? (
                <TouchableOpacity onPress={clearLink} style={styles.inputIcon}>
                  <Feather name="x-circle" size={20} color="#ef4444" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={handlePaste} style={styles.inputIcon}>
                  <Feather name="clipboard" size={20} color="#4f46e5" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
              style={[styles.downloadBtn, loading && styles.downloadBtnDisabled]}
              onPress={handleResolve}
              disabled={loading}
            >
              <LinearGradient
                colors={loading ? ["#9ca3af", "#6b7280"] : ["#4f46e5", "#7c3aed"]}
                style={styles.btnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {loading ? (
                  <View style={styles.btnContent}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.btnText}>Checking...</Text>
                  </View>
                ) : (
                  <View style={styles.btnContent}>
                    <Feather name="arrow-right-circle" size={20} color="#fff" />
                    <Text style={styles.btnText}>Continue</Text>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Access</Text>
          <View style={styles.actionsRow}>
            {/* <ActionCard
              icon="message-circle"
              title="WhatsApp Status"
              subtitle="Save statuses"
              color="#25D366"
              onPress={() => navigation.navigate("Saver")}
            /> */}
            <ActionCard
              icon="folder"
              title="My Videos"
              subtitle="View saved media"
              color="#6366f1"
              onPress={() => navigation.navigate("Downloads")}
            />
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Download Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Quality</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Feather name="x" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {videoData?.thumbnail ? (
                <Image
                  source={{ uri: videoData.thumbnail }}
                  style={styles.thumbnail}
                />
              ) : null}

              <Text style={styles.videoTitle} numberOfLines={2}>
                {videoData?.title}
              </Text>

              {/* Platform Badge */}
              {videoData?.platform && (
                <View style={styles.platformBadge}>
                  <Text style={styles.platformText}>{videoData.platform}</Text>
                </View>
              )}
              {videoData?.warning ? (
                <View style={styles.warningBadge}>
                  <Text style={styles.warningText}>{videoData.warning}</Text>
                </View>
              ) : null}
              <View style={styles.formatsContainer}>
                {videoData?.formats?.map((f, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.qualityBtn}
                    onPress={() => startDownload(f)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.qualityLeft}>
                      <View style={styles.qualityIcon}>
                        <Feather
                          name={f.isExternal ? "external-link" : "download"}
                          size={18}
                          color="#4f46e5"
                        />
                      </View>
                      <View>
                        <Text style={styles.qualityText}>
                          {"Video"}
                        </Text>
                        <Text style={styles.sizeText}>
                          {"Video Quality: " + (f.quality) + (f.videoOnly ? " • no audio" : "")}
                        </Text>
                      </View>
                    </View>
                    <Feather name="chevron-right" size={20} color="#9ca3af" />
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <BannerBottom />
    </SafeAreaView>
  );
}

function ActionCard({ icon, title, subtitle, color, onPress }) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.actionIcon, { backgroundColor: color + "15" }]}>
        <Feather name={icon} size={24} color={color} />
      </View>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionSubtitle}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb"
  },
  downloadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    zIndex: 9999,
    justifyContent: "center",
    alignItems: "center"
  },
  downloadingCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    width: "80%",
    maxWidth: 300
  },
  downloadingIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20
  },
  downloadingTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8
  },
  downloadingPercent: {
    fontSize: 32,
    fontWeight: "800",
    color: "#4f46e5",
    marginBottom: 16
  },
  progressBarContainer: {
    width: "100%",
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 12
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#4f46e5",
    borderRadius: 4
  },
  downloadingSubtext: {
    fontSize: 14,
    color: "#6b7280"
  },
  headerGradient: {
    paddingTop: 10,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    marginBottom: 20
  },
  brand: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff"
  },
  brandSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center"
  },
  heroSection: {
    alignItems: "center",
    paddingHorizontal: 20
  },
  iconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 6
  },
  content: {
    flex: 1,
    marginTop: -20
  },
  autoPasteBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dbeafe"
  },
  autoPasteContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  autoPasteText: {
    fontSize: 14,
    color: "#1e40af",
    fontWeight: "500"
  },
  autoPasteBtn: {
    fontSize: 14,
    color: "#4f46e5",
    fontWeight: "700"
  },
  inputCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 20,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3
  },
  inputHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827"
  },
  inputContainer: {
    marginBottom: 16
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    paddingHorizontal: 14
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 14,
    color: "#111827"
  },
  inputIcon: {
    padding: 6
  },
  downloadBtn: {
    borderRadius: 14,
    overflow: "hidden"
  },
  downloadBtnDisabled: {
    opacity: 0.7
  },
  btnGradient: {
    paddingVertical: 16,
    alignItems: "center"
  },
  btnContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700"
  },
  quickActions: {
    paddingHorizontal: 16,
    marginBottom: 20
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12
  },
  actionCard: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4
  },
  actionSubtitle: {
    fontSize: 12,
    color: "#6b7280"
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end"
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
    maxHeight: "85%"
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827"
  },
  thumbnail: {
    width: "100%",
    height: 200,
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: "#f3f4f6"
  },
  videoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12
  },
  platformBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 16
  },
  platformText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4f46e5"
  },
  warningBadge: {
    backgroundColor: "#fff7ed",
    borderColor: "#fdba74",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  warningText: {
    color: "#9a3412",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18
  },
  formatsContainer: {
    gap: 10
  },
  qualityBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb"
  },
  qualityLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  qualityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center"
  },
  qualityText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827"
  },
  sizeText: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2
  }
});
