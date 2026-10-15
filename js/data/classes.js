// Platforms. Figures come from AgiBot's own pages (agibot.com, store.agibot.com, open.agibot.com), checked Oct 4, 2026.
// Manufacturer figures take precedence over retailer listings. Anything not published by AgiBot is marked as a planning assumption.
export const CLASSES = {
  full: {
    id: 'full', kind: 'biped', name: 'Full-size', short: 'A2 Ultra-class', btn: 'A2',
    heightCm: 169, massKg: 69, dof: 40,
    dofNote: '2 neck + 7×2 arms + 6×2 hands + 6×2 legs',
    scale: 1.0, viewH: 1.72, viewW: 1.35, centerY: 0.9, tagY: 1.86,
    compute: '16-core CPU + NVIDIA Jetson Orin 64 GB',
    battery: '14.4 Ah swappable · charger 54.6 V 8 A · ~1.5 h+ walking',
    kneeTorque: 'peak knee 270 N·m (512 N·m joint reported elsewhere)',
    sensors: '3D lidar, RGB-D, RGB, fisheye cameras, mic array, facial screen',
    radio: 'Wireless e-stop and remote',
    source: 'Published AgiBot A2 Ultra specs (agibot.com).',
    assumptions: [],
  },
  compact: {
    id: 'compact', kind: 'biped', name: 'Compact', short: 'X2 Ultra-class', btn: 'X2',
    heightCm: 131, massKg: 39, dof: 30,
    dofNote: '30 total actuated DoF (AgiBot X2 developer docs). The per-joint split shown (neck, arms, waist, legs) is a modeling assumption; hands are optional end-effectors, not in the 30',
    scale: 131 / 169, viewH: 1.72 * 131 / 169, viewW: 1.35 * 131 / 169, centerY: 0.9 * 131 / 169, tagY: 1.86,
    compute: 'RK3588 ×2 + Orin NX (157 TOPS)',
    battery: '~500 Wh swappable · charger 54.6 V 10 A · ~2 h at 0.5 m/s',
    kneeTorque: 'peak joint torque 120 N·m',
    sensors: '3D lidar, RGB-D, interactive RGB + front dual RGB + rear RGB, mic array, interactive screen',
    radio: 'Wi-Fi, Bluetooth, 4G/5G; UWB on the new version',
    source: 'Published AgiBot X2 Ultra (new version) specs (agibot.com / store.agibot.com). About 39 kg is AgiBot\u2019s own figure; a retailer listing of 35 kg is not used because manufacturer figures take precedence. Hands (Omnihand) are sold separately. AgiBot\u2019s X2 developer docs (https://x2-aimdk.agibot.com/en/latest/about_agibot_X2/robot_specifications.html) give about 39 kg and 30 total actuated DoF.',
    assumptions: [],
  },
  a3: {
    id: 'a3', kind: 'biped', name: 'Stage humanoid', short: 'A3-class', btn: 'A3',
    heightCm: 173, massKg: 55, dof: 31,
    dofNote: '2 neck + 7×2 arms + 3 waist + 6×2 legs (dexterous hands optional, 6 DOF each on the standard listing)',
    scale: 1.0, viewH: 1.76, viewW: 1.2, centerY: 0.9, tagY: 1.9,
    compute: 'MDU on RK3588 (8-core, 16 GB) + HDU on RK3588S2 (8-core, 16 GB)',
    battery: 'Dual hot-swappable packs · 1152 Wh · up to 10 h · charge ≤2 h',
    kneeTorque: '12 kW peak power, 0.218 kW/kg. Knee torque is not on AgiBot\u2019s pages (a retailer lists 320 N·m; planning assumption)',
    sensors: 'Dual binocular cameras on the head, 360° multi-array microphones, shoulder touch sensing',
    radio: 'Wi-Fi, Bluetooth, dual-module 5G, UWB positioning (<±10 cm)',
    source: 'Published AgiBot A3 specs (agibot.com/products/A3, store.agibot.com/products/a3, and the A3 developer overview on open.agibot.com). Magnesium alloy, titanium alloy, and TPU body.',
    assumptions: ['Knee torque', 'IMU, foot sensors, BMS, and harness placement', 'DOF split within each limb follows AgiBot\u2019s published joint list (J1–J7 arm, J1–J6 leg)'],
  },
  d1: {
    id: 'd1', kind: 'quad', name: 'Quadruped', short: 'D1-class', btn: 'D1',
    heightCm: 42, massKg: 16, dof: 12, dims: '630 × 360 × 420 mm standing (L × W × H)',
    dofNote: '3 per leg × 4 legs (body/abduction, thigh, calf)',
    scale: 1.0, viewH: 0.62, viewW: 0.95, centerY: 0.26, tagY: 0.62,
    compute: 'Not listed on the D1 Ultra sheet. D1 Pro/Edu list an 8-core CPU',
    battery: '43.2 V, 4.6 Ah rated (5 Ah nominal) · 1–2 h · ~1 h charge (10–90%) · charging dock standard',
    kneeTorque: 'max joint torque 48 N·m, dual-encoder joints',
    sensors: '1920×1080 camera (DFOV 122°), IMU standard; 3D lidar, depth camera, and RTK are optional expansions',
    radio: 'Wi-Fi 5 (2.4 GHz, 21 dBm), Bluetooth 5.0; 4G/5G optional module',
    source: 'Published AgiBot D1 Ultra technical specification sheet and product page (agibot.com). 16 kg with battery, IP54, aluminum alloy with engineering plastic.',
    assumptions: ['Compute module type and placement', 'Harness and BMS placement'],
  },
};

export const ORDER = ['full', 'compact', 'a3', 'd1'];
export const LINEUP = { both: { full: -0.42, compact: 0.42 }, lineup: { full: -0.98, a3: -0.33, compact: 0.3, d1: 1.0 } };

// Per-line spec sources. Each spec line on the platform card carries its own badge.
export const SOURCES = {
  a2u: { name: 'agibot.com A2 Ultra spec table', url: 'https://www.agibot.com/products/A2_Ultra', kind: 'off' },
  a2: { name: 'agibot.com A2 page', url: 'https://www.agibot.com/products/A2', kind: 'off' },
  a2s: { name: 'AgiBot store A2 Ultra listing', url: 'https://store.agibot.com/products/a2-ultra', kind: 'off' },
  x2dev: { name: 'AgiBot X2 developer docs: robot specifications', url: 'https://x2-aimdk.agibot.com/en/latest/about_agibot_X2/robot_specifications.html', kind: 'off' },
  x2: { name: 'agibot.com X2 / AgiBot store X2 Ultra', url: 'https://www.agibot.com/products/X2', kind: 'off' },
  a3: { name: 'agibot.com A3 page / AgiBot store', url: 'https://www.agibot.com/products/A3', kind: 'off' },
  a3d: { name: 'AgiBot A3 developer overview', url: 'https://open.agibot.com/docs/en/aimdk/a3/v3_2/dev_guide/01-a3_overview', kind: 'off' },
  d1u: { name: 'AgiBot D1 Ultra page and spec sheet', url: 'https://agibot.com/products/D1Ultra', kind: 'off' },
  d1p: { name: 'agibot.com D1 Pro/Edu page', url: 'https://www.agibot.com/products/D1_Pro', kind: 'off' },
  ret: { name: 'Reported elsewhere', kind: 'ret' },
  pa: { name: 'Planning assumption', kind: 'pa' },
};
const S = (label, text, src) => ({ label, text, src });
CLASSES.full.specs = [
  S('Size', '169 cm (H) × 75 cm (W) × 30 cm (L), about 69 kg', 'a2u'),
  S('DOF', '40 total: 2 neck, 7 per arm, 6 per leg, 6-DOF dexterous hands', 'a2u'),
  S('Limb split', '3-1-3 arm and 3-1-2 leg split of those DOF', 'pa'),
  S('Compute', '16-core high-performance CPU + NVIDIA Jetson Orin 64G', 'a2u'),
  S('Compute', 'Store listing names it Jetson AGX Orin 64G', 'a2s'),
  S('Battery', '14.4 Ah, swappable, fast charging; standing 3 h, walking 1.5 h+', 'a2u'),
  S('Battery', '700 Wh, about 2 h runtime, battery swapping', 'a2'),
  S('Charging', 'Charger output 54.6 V 8 A, input 110–220 V, about 2 h', 'a2u'),
  S('Charging', 'Charging power ≤500 W, charging voltage 48 V DC, 2 h', 'a2s'),
  S('Torque', 'Peak knee torque 270 N·m', 'a2u'),
  S('Torque', 'Integrated joint with 512 N·m peak torque (not found on the official spec tables)', 'ret'),
  S('Sensors', '3D lidar, RGB-D, RGB, and fisheye cameras; mic array; facial screen', 'a2u'),
  S('Sensors', '360° lidar and six HD cameras; force/torque sensors', 'a2'),
  S('Radios', 'Wi-Fi, 4G/5G; wireless e-stop and remote in the box', 'a2u'),
];
CLASSES.compact.specs = [
  S('Size', '1310 × 460 × 210 mm, about 39 kg (a retailer\u2019s 35 kg is not used)', 'x2dev'),
  S('DOF', '30 total actuated (X2 developer docs); per-joint split is a modeling assumption; hands optional', 'x2dev'),
  S('Compute', 'RK3588 ×2 + Orin NX (157 TOPS)', 'x2'),
  S('Battery', '~500 Wh, swappable; charger 54.6 V 10 A; ~2 h at 0.5 m/s', 'x2'),
  S('Torque', 'Peak joint torque 120 N·m', 'x2'),
  S('Sensors', '3D lidar, RGB-D, interactive + front dual + rear RGB, mic array, screen', 'x2'),
  S('Radios', 'Wi-Fi, Bluetooth, 4G/5G; UWB on the new version', 'x2'),
];
CLASSES.a3.specs = [
  S('Size', '173 × 52 × 30 cm, about 55 kg; magnesium, titanium, TPU', 'a3'),
  S('DOF', '31: 2 neck, 7 per arm, 3 waist, 6 per leg; hands optional', 'a3d'),
  S('Compute', 'MDU RK3588 (8-core, 16 GB) + HDU RK3588S2 (8-core, 16 GB)', 'a3d'),
  S('Battery', 'Dual hot-swap packs, 1152 Wh, up to 10 h, charge ≤2 h', 'a3'),
  S('Power', '12 kW peak, 0.218 kW/kg, 150 A max current', 'a3'),
  S('Torque', 'Knee 320 N·m (retailer listing)', 'ret'),
  S('Sensors', 'Dual binocular head cameras, 360° mic array, shoulder touch', 'a3'),
  S('Radios', 'Dual-module 5G, Wi-Fi, Bluetooth, UWB (<±10 cm)', 'a3'),
  S('Other', 'IMU, foot sensors, BMS and harness placement', 'pa'),
];
CLASSES.d1.specs = [
  S('Size', '630 × 360 × 420 mm standing, 16 kg with battery, IP54', 'd1u'),
  S('DOF', '12: 3 per leg (body, thigh, calf)', 'd1u'),
  S('Compute', 'High-performance 8-core CPU (D1 Pro/Edu; not on the D1 Ultra sheet)', 'd1p'),
  S('Battery', '43.2 V, 4.6 Ah rated; 1–2 h; ~1 h charge; charging dock standard', 'd1u'),
  S('Torque', 'Max joint torque 48 N·m, dual-encoder joints', 'd1u'),
  S('Sensors', '1080p camera (DFOV 122°), IMU; lidar/depth/RTK optional', 'd1u'),
  S('Radios', 'Wi-Fi 5 (2.4 GHz, 21 dBm), Bluetooth 5.0', 'd1u'),
  S('Other', 'Compute module type and placement; reducer type', 'pa'),
];
