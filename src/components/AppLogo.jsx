import { Image } from "react-native";

const logoSource = require("../../assets/logo.png");

/**
 * Gone Not Forgotten logo — uses the client-provided brand mark image.
 * @param {number} size - Display height in points (default 36). Width scales proportionally.
 * @param {string} tintColor - Optional tint (e.g. "#fff" for dark backgrounds).
 */
export default function AppLogo({ size = 36, tintColor }) {
  // Original image ratio is ~162:153 (≈ 1.06:1)
  const width = Math.round(size * (162 / 153));

  return (
    <Image
      source={logoSource}
      style={{
        width,
        height: size,
        ...(tintColor ? { tintColor } : {}),
      }}
      resizeMode="contain"
    />
  );
}
