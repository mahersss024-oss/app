import { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts } from "../../ui/theme";

const WELCOME_VISIBLE_MS = 950;
const WELCOME_FADE_MS = 260;
const WORDMARK_ASPECT_RATIO = 846 / 214;

type BrandWelcomeSplashProps = {
  onFinish: () => void;
};

export function BrandWelcomeSplash({ onFinish }: BrandWelcomeSplashProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [opacity] = useState(() => new Animated.Value(1));
  const [footerOpacity] = useState(() => new Animated.Value(0));
  const [footerRise] = useState(() => new Animated.Value(14));
  const [loaderProgress] = useState(() => new Animated.Value(0));

  const trackWidth = Math.min(width * 0.54, 220);
  const indicatorWidth = trackWidth * 0.34;
  const wordmarkWidth = Math.min(width * 0.78, 416);
  const wordmarkHeight = wordmarkWidth / WORDMARK_ASPECT_RATIO;
  const loaderTranslateX = loaderProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-indicatorWidth, trackWidth],
  });

  useEffect(() => {
    const loader = Animated.loop(
      Animated.timing(loaderProgress, {
        toValue: 1,
        duration: 1450,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    );
    const showFooter = Animated.parallel([
      Animated.timing(footerOpacity, {
        toValue: 1,
        duration: 640,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(footerRise, {
        toValue: 0,
        duration: 640,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    loader.start();
    showFooter.start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: WELCOME_FADE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) onFinish();
      });
    }, WELCOME_VISIBLE_MS);

    return () => {
      clearTimeout(timer);
      loader.stop();
      showFooter.stop();
      opacity.stopAnimation();
    };
  }, [footerOpacity, footerRise, loaderProgress, onFinish, opacity]);

  return (
    <Animated.View
      accessibilityViewIsModal
      pointerEvents="auto"
      style={[StyleSheet.absoluteFill, styles.root, { opacity }]}
    >
      <LinearGradient
        colors={["#08111D", "#0D2B28", "#117C8B"]}
        locations={[0, 0.44, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[
          styles.greenGlow,
          {
            top: height * 0.08,
            left: width * 0.1,
            width: width * 0.82,
            height: width * 0.82,
            borderRadius: width,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.tealGlow,
          {
            top: height * 0.3,
            left: width * 0.62,
            width: width * 0.82,
            height: width * 0.82,
            borderRadius: width,
          },
        ]}
      />
      <LinearGradient
        colors={[
          "rgba(8, 17, 29, 0.08)",
          "rgba(8, 17, 29, 0)",
          "rgba(8, 17, 29, 0.36)",
        ]}
        locations={[0, 0.34, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Image
        accessibilityLabel="شعار سوق حمد"
        accessible
        contentFit="contain"
        source={require("../../../assets/hamad-market-wordmark.webp")}
        style={[
          styles.wordmark,
          {
            width: wordmarkWidth,
            height: wordmarkHeight,
            top: height * 0.42 - wordmarkHeight / 2,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + 72,
            opacity: footerOpacity,
            transform: [{ translateY: footerRise }],
          },
        ]}
      >
        <Text style={styles.tagline}>سوقك الذكي للبيع والشراء</Text>
        <View
          accessible
          accessibilityLabel="جارٍ تشغيل التطبيق"
          accessibilityRole="progressbar"
          style={[styles.track, { width: trackWidth }]}
        >
          <Animated.View
            style={[
              styles.indicator,
              {
                width: indicatorWidth,
                transform: [{ translateX: loaderTranslateX }],
              },
            ]}
          >
            <LinearGradient
              colors={[
                "rgba(90, 200, 255, 0.32)",
                "#FFFFFF",
                "rgba(143, 255, 199, 0.42)",
              ]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    zIndex: 1000,
    elevation: 1000,
    overflow: "hidden",
    backgroundColor: "#0D2B28",
  },
  greenGlow: {
    position: "absolute",
    backgroundColor: "#1CC26F",
    opacity: 0.18,
  },
  tealGlow: {
    position: "absolute",
    backgroundColor: "#117C8B",
    opacity: 0.22,
  },
  wordmark: {
    position: "absolute",
    alignSelf: "center",
  },
  footer: {
    position: "absolute",
    right: 24,
    bottom: 0,
    left: 24,
    alignItems: "center",
    gap: 13,
  },
  tagline: {
    color: "rgba(244, 252, 255, 0.94)",
    fontFamily: fonts.medium,
    fontSize: 16,
    textAlign: "center",
    textShadowColor: "rgba(8, 17, 29, 0.58)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 16,
  },
  track: {
    height: 4,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "rgba(244, 252, 255, 0.24)",
  },
  indicator: {
    height: 4,
    overflow: "hidden",
    borderRadius: 999,
  },
});
