import React, { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import {
  BannerAd,
  BannerAdSize,
  TestIds,
  InterstitialAd,
  AdEventType
} from "react-native-google-mobile-ads";

// Test IDs; replace with your real Ad Unit IDs for production
export const BANNER_ID = TestIds.BANNER;
export const INTERSTITIAL_ID = TestIds.INTERSTITIAL;

export function BannerBottom() {
  return (
    <View style={{ alignItems: "center", paddingVertical: 8 }}>
      <BannerAd
        unitId={BANNER_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      />
    </View>
  );
}

export function useInterstitial() {
  const interstitial = useMemo(
    () =>
      InterstitialAd.createForAdRequest(INTERSTITIAL_ID, {
        requestNonPersonalizedAdsOnly: true
      }),
    []
  );

  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const onLoaded = interstitial.addAdEventListener(
      AdEventType.LOADED,
      () => setLoaded(true)
    );
    const onClosed = interstitial.addAdEventListener(
      AdEventType.CLOSED,
      () => {
        setLoaded(false);
        interstitial.load();
      }
    );
    const onError = interstitial.addAdEventListener(
      AdEventType.ERROR,
      () => setLoaded(false)
    );

    interstitial.load();

    return () => {
      onLoaded();
      onClosed();
      onError();
    };
  }, [interstitial]);

  const show = () => {
    if (loaded) {
      interstitial.show();
    }
  };

  return { show, loaded };
}
