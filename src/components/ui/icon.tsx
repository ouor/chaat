import Svg, { Circle, Path } from 'react-native-svg';

const PATHS: Record<IconName, (color: string) => React.ReactNode> = {
  back: (c) => (
    <Path
      d="M10.5 1.5L3.5 8l7 6.5"
      stroke={c}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  down: (c) => (
    <Path
      d="M5 1v7M1.6 5L5 8.5 8.4 5"
      stroke={c}
      strokeWidth={1.6}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  more: (c) => (
    <>
      <Circle cx="2" cy="8" r="1.7" fill={c} />
      <Circle cx="8" cy="8" r="1.7" fill={c} />
      <Circle cx="14" cy="8" r="1.7" fill={c} />
    </>
  ),
};

export type IconName = 'back' | 'down' | 'more';

export function Icon({
  name,
  size = 16,
  color,
}: {
  name: IconName;
  size?: number;
  color: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      {PATHS[name](color)}
    </Svg>
  );
}
