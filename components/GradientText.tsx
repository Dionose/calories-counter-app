// components/GradientText.tsx
// Text painted with a gradient — React Native can't do this natively, so the
// string is measured with an invisible Text and then redrawn as SVG text with
// a gradient fill. Used for the Ultimate tier, where flat colour won't do.
import React, { useRef, useState } from "react";
import { StyleProp, Text, TextStyle, View } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from "react-native-svg";

let idCounter = 0;

type Props = {
  text: string;
  colors: string[];
  fontSize: number;
  fontFamily: string;
  /** passed to the measuring Text so the SVG matches exactly */
  style?: StyleProp<TextStyle>;
};

export default function GradientText({ text, colors, fontSize, fontFamily, style }: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const id = useRef(`gt${++idCounter}`).current;

  return (
    <View>
      {/* measured, never seen */}
      <Text
        style={[style, { fontSize, fontFamily, opacity: 0 }]}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (width > 0 && (Math.abs(width - size.w) > 0.5 || Math.abs(height - size.h) > 0.5)) {
            setSize({ w: width, h: height });
          }
        }}
      >
        {text}
      </Text>

      {size.w > 0 && (
        <Svg width={size.w + 2} height={size.h} style={{ position: "absolute", top: 0, left: 0 }}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
              {colors.map((c, i) => (
                <Stop key={i} offset={`${(i / (colors.length - 1)) * 100}%`} stopColor={c} />
              ))}
            </LinearGradient>
          </Defs>
          <SvgText
            x={0}
            y={size.h * 0.78}
            fontSize={fontSize}
            fontFamily={fontFamily}
            fill={`url(#${id})`}
          >
            {text}
          </SvgText>
        </Svg>
      )}
    </View>
  );
}