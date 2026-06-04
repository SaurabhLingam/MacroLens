import { useMemo, useRef } from "react";

export default function useParallaxHeader() {
  const scrollYRef = useRef({ value: 0 });

  const scrollHandler = (event) => {
    scrollYRef.current.value = event?.nativeEvent?.contentOffset?.y ?? 0;
  };

  const heroAnimatedStyle = {};

  return useMemo(
    () => ({
      scrollY: scrollYRef.current,
      scrollHandler,
      heroAnimatedStyle,
    }),
    [],
  );
}
