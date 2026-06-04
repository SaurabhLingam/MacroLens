import { useRef, useEffect } from "react";
import { Animated } from "react-native";

const SPRING_CONFIG = { tension: 65, friction: 10 };
const DELAY_MS = 500;

/**
 * Returns { opacityAnim, slideAnim, animatedStyle }
 *
 * opacityAnim / slideAnim  – raw Animated.Values (for multi-block usage)
 * animatedStyle            – convenience style object combining both
 *
 * @param {*} deps  – dependency array; re-triggers animation when changed
 * @param {object} options
 *   startHidden  – if true (default) values start at {opacity:0, translateY:30}
 *                  if false they start at {opacity:1, translateY:0}
 */
export default function useWellnessAnimation(
  deps = [],
  { startHidden = true } = {},
) {
  const opacityAnim = useRef(new Animated.Value(startHidden ? 0 : 1)).current;
  const slideAnim = useRef(new Animated.Value(startHidden ? 30 : 0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.spring(opacityAnim, {
          toValue: 1,
          useNativeDriver: true,
          ...SPRING_CONFIG,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          ...SPRING_CONFIG,
        }),
      ]).start();
    }, DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const animatedStyle = {
    opacity: opacityAnim,
    transform: [{ translateY: slideAnim }],
  };

  return { opacityAnim, slideAnim, animatedStyle };
}
