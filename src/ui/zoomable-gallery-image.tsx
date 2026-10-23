import { StyleSheet, useWindowDimensions, View } from "react-native";
import {
  GestureDetector,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Image } from "expo-image";

type ZoomableGalleryImageProps = {
  source?: string;
  accessibilityLabel: string;
};

const MIN_SCALE = 1;
const MAX_SCALE = 5;

function clamp(value: number, min: number, max: number) {
  "worklet";
  return Math.min(max, Math.max(min, value));
}

export function ZoomableGalleryImage({
  source,
  accessibilityLabel,
}: ZoomableGalleryImageProps) {
  const { width, height } = useWindowDimensions();
  const scale = useSharedValue(MIN_SCALE);
  const savedScale = useSharedValue(MIN_SCALE);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const pinchOriginX = useSharedValue(0);
  const pinchOriginY = useSharedValue(0);
  const isZoomed = useSharedValue(false);
  const isPinching = useSharedValue(false);

  const pinch = usePinchGesture({
    onActivate: (event) => {
      isPinching.value = true;
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      const focalX = event.focalX - width / 2;
      const focalY = event.focalY - height / 2;
      pinchOriginX.value =
        (focalX - savedTranslateX.value) / Math.max(savedScale.value, MIN_SCALE);
      pinchOriginY.value =
        (focalY - savedTranslateY.value) / Math.max(savedScale.value, MIN_SCALE);
    },
    onUpdate: (event) => {
      const nextScale = clamp(savedScale.value * event.scale, MIN_SCALE, MAX_SCALE);
      const focalX = event.focalX - width / 2;
      const focalY = event.focalY - height / 2;
      scale.value = nextScale;
      const maxX = (width * (nextScale - MIN_SCALE)) / 2;
      const maxY = (height * (nextScale - MIN_SCALE)) / 2;
      translateX.value = clamp(
        focalX - pinchOriginX.value * nextScale,
        -maxX,
        maxX,
      );
      translateY.value = clamp(
        focalY - pinchOriginY.value * nextScale,
        -maxY,
        maxY,
      );
    },
    onDeactivate: () => {
      isPinching.value = false;
      if (scale.value <= MIN_SCALE + 0.02) {
        scale.value = MIN_SCALE;
        savedScale.value = MIN_SCALE;
        translateX.value = 0;
        translateY.value = 0;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        isZoomed.value = false;
        return;
      }
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      isZoomed.value = true;
    },
  });

  const pan = usePanGesture({
    enabled: isZoomed,
    minDistance: 1,
    averageTouches: true,
    onActivate: () => {
      panStartX.value = translateX.value;
      panStartY.value = translateY.value;
    },
    onUpdate: (event) => {
      if (isPinching.value) return;
      const maxX = (width * (scale.value - MIN_SCALE)) / 2;
      const maxY = (height * (scale.value - MIN_SCALE)) / 2;
      translateX.value = clamp(panStartX.value + event.translationX, -maxX, maxX);
      translateY.value = clamp(panStartY.value + event.translationY, -maxY, maxY);
    },
    onDeactivate: () => {
      if (isPinching.value) return;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    maxDelay: 280,
    onDeactivate: (event) => {
      if (event.canceled) return;
      if (isZoomed.value) {
        isZoomed.value = false;
        scale.value = withTiming(MIN_SCALE, { duration: 160 });
        translateX.value = withTiming(0, { duration: 160 });
        translateY.value = withTiming(0, { duration: 160 });
        savedScale.value = MIN_SCALE;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        return;
      }
      isZoomed.value = true;
      savedScale.value = 2.5;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
      scale.value = withTiming(2.5, { duration: 160 });
      translateX.value = withTiming(0, { duration: 160 });
      translateY.value = withTiming(0, { duration: 160 });
    },
  });

  const gesture = useSimultaneousGestures(pan, pinch, doubleTap);
  const positionStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));
  const zoomStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityLabel={accessibilityLabel}
        style={[styles.page, { width, height }]}
      >
        <Animated.View style={[StyleSheet.absoluteFill, positionStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, zoomStyle]}>
            {source ? (
              <Image
                source={source}
                contentFit="contain"
                transition={180}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
          </Animated.View>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  page: { width: "100%", height: "100%", overflow: "hidden" },
});
