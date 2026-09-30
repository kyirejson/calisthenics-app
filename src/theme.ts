export const colors = {
  ink: '#151712',
  inkMuted: '#5F625A',
  paper: '#F5F3ED',
  card: '#FFFFFF',
  line: '#E5E2D9',
  lime: '#C8F04D',
  limeDark: '#9ABB31',
  orange: '#F06A3A',
  blue: '#3767E8',
  green: '#228B5A',
  danger: '#D84A3A',
};

export const radius = { sm: 12, md: 18, lg: 26, pill: 999 };

// Shared fitness surfaces. Legacy onboarding/profile colours remain independent.
export const appPalette = {
  background: '#0D1114', card: '#1B2028', raised: '#222833', border: '#343C48',
  text: '#F4F6FA', muted: '#A8B1BF', faint: '#818D9F', lime: '#C7F548',
  onLime: '#151A0B', olive: '#242E20', oliveBorder: '#607836',
  warning: '#EDC180', warningBackground: '#31291D', danger: '#FFAB9C',
} as const;

// Foreground-first semantic colours for dark fitness screens and their sheets.
export const fitnessColors = {
  ink: appPalette.text, inkMuted: appPalette.muted, paper: appPalette.background,
  card: appPalette.card, line: appPalette.border, lime: appPalette.lime,
  limeDark: '#97B940', orange: '#FF9669', blue: '#94B5FF', green: appPalette.lime,
  danger: appPalette.danger,
} as const;

// All main screens share this canvas, including the three Today panes.
export const progressPageLayout = {
  background: '#0D1114',
  content: { width: '100%', maxWidth: 440, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 110 },
  title: { fontSize: 22, fontWeight: '900', letterSpacing: -0.6 },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  actionTitle: { fontSize: 16, fontWeight: '800' },
  controlText: { fontSize: 13, fontWeight: '700' },
  minTouchHeight: 44,
  cardRadius: 20,
  summaryRingSize: 64,
} as const;
