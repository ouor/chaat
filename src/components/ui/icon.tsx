import Svg, { Circle, Path } from 'react-native-svg';

// 24-unit line icons (Feather-style, MIT shapes). One stroke weight so every screen reads the same.
const STROKE = 2;

const line = (c: string, d: string) => (
  <Path d={d} stroke={c} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" fill="none" />
);

const STAR = 'M12 2.8l2.84 5.76 6.36.92-4.6 4.49 1.08 6.33L12 17.31l-5.68 2.99 1.08-6.33-4.6-4.49 6.36-.92L12 2.8z';

const PATHS: Record<IconName, (color: string) => React.ReactNode> = {
  back: (c) => line(c, 'M15 5l-7 7 7 7'),
  chevron: (c) => line(c, 'M9 6l6 6-6 6'),
  down: (c) => line(c, 'M12 5v14M6 13l6 6 6-6'),
  close: (c) => line(c, 'M6 6l12 12M18 6L6 18'),
  check: (c) => line(c, 'M5 12.5l4.5 4.5L19 7.5'),
  search: (c) => (
    <>
      <Circle cx="11" cy="11" r="7" stroke={c} strokeWidth={STROKE} fill="none" />
      {line(c, 'M20 20l-3.5-3.5')}
    </>
  ),
  gear: (c) => (
    <>
      <Circle cx="12" cy="12" r="3" stroke={c} strokeWidth={STROKE} fill="none" />
      {line(
        c,
        'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
      )}
    </>
  ),
  star: (c) => line(c, STAR),
  starFilled: (c) => <Path d={STAR} fill={c} stroke={c} strokeWidth={STROKE} strokeLinejoin="round" />,
  history: (c) => (
    <>
      {line(c, 'M3 12a9 9 0 1 0 2.64-6.36L3 8.27')}
      {line(c, 'M3 3v5.27h5.27M12 7.5V12l3 2')}
    </>
  ),
  chat: (c) => line(c, 'M21 11.5a8.38 8.38 0 0 1-9 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.2A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3h.5a8.48 8.48 0 0 1 8 8v.5z'),
  moon: (c) => line(c, 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z'),
  phone: (c) => (
    <>
      {line(c, 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z')}
      {line(c, 'M11 18h2')}
    </>
  ),
  lock: (c) => (
    <>
      {line(c, 'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z')}
      {line(c, 'M7 11V7a5 5 0 0 1 10 0v4')}
    </>
  ),
  export: (c) => line(c, 'M4 13v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6M16 7l-4-4-4 4M12 3v12'),
  megaphone: (c) => line(c, 'M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13'),
};

export type IconName =
  | 'back'
  | 'chevron'
  | 'down'
  | 'close'
  | 'check'
  | 'search'
  | 'gear'
  | 'star'
  | 'starFilled'
  | 'history'
  | 'chat'
  | 'moon'
  | 'phone'
  | 'lock'
  | 'megaphone'
  | 'export';

export function Icon({
  name,
  size = 22,
  color,
}: {
  name: IconName;
  size?: number;
  color: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {PATHS[name](color)}
    </Svg>
  );
}
