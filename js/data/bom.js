// Planner lines (parts table) per platform. Unit costs are RELATIVE PLACEHOLDERS, not quotes and not AgiBot data.
// A2 defaults keep the assumed totals used on the compliance notes site (joints 60, compute 12, cameras/lidar 8,
// battery 8, frame 7, harness 3, other 2 = 100), with compute split 8 for the Jetson module and 4 for the CPU/carrier. Replace them with real quotes.
// tag drives the presets; joint lines are what the inside-the-joint parts (reducer, encoders, torque sensors) map to.
const L = (id, tag, name, qty, unit, covers) => ({ id, tag, name, qty, unit, covers });

export const BOM = {
  full: [
    L('jLeg', 'joints', 'Leg joint modules', 12, 1.5, 'Hips, knees, ankles (6 per leg)'),
    L('jArm', 'joints', 'Arm joint modules', 14, 1.5, 'Shoulders, elbows, wrists (7 per arm)'),
    L('jNeck', 'joints', 'Neck joint modules', 2, 1.5, 'Neck (2 DOF)'),
    L('hands', 'joints', 'Dexterous hands (6 DOF each)', 2, 9, 'Left and right hands'),
    L('frame', 'frame', 'Frame and structure', 1, 7, 'Links, chassis, covers, feet'),
    L('harness', 'harness', 'Wiring harness', 1, 3, 'Power and data cabling'),
    L('battery', 'battery', 'Battery pack and charger', 1, 8, 'Swappable pack, BMS, charger'),
    L('ai', 'ai', 'AI module (Jetson Orin 64 GB)', 1, 8, 'GPU module; likely the costliest electronic part (placeholder)'),
    L('cpu', 'cpu', 'Main CPU and compute carrier', 1, 4, '16-core CPU board, carrier; US credit depends on the open subassembly question'),
    L('lidar', 'sensors', '3D lidar', 1, 3, 'Head/collar lidar'),
    L('depth', 'sensors', 'RGB-D depth camera', 1, 2, 'Chin depth camera'),
    L('rgb', 'sensors', 'RGB camera', 1, 1, 'Forehead color camera'),
    L('fisheye', 'sensors', 'Fisheye cameras', 2, 1, 'Side-of-head wide-angle cameras'),
    L('other', 'other', 'Everything else', 1, 2, 'Face screen, radios, IMU, mics, foot sensors'),
  ],
  compact: [
    L('jLeg', 'joints', 'Leg joint modules', 12, 1.5, 'Hips, knees, ankles (6 per leg)'),
    L('jArm', 'joints', 'Arm joint modules', 14, 1.5, 'Shoulders, elbows, wrists (7 per arm)'),
    L('jNeck', 'joints', 'Neck joint modules', 2, 1.5, 'Neck (2 DOF)'),
    L('jWaist', 'joints', 'Waist joint modules', 3, 1.5, 'Waist (3 DOF)'),
    L('frame', 'frame', 'Frame and structure', 1, 6, 'Links, chassis, covers, feet'),
    L('harness', 'harness', 'Wiring harness', 1, 3, 'Power and data cabling'),
    L('battery', 'battery', 'Battery pack and charger', 1, 7, '~500 Wh pack, BMS, charger'),
    L('ai', 'ai', 'AI module (Jetson Orin NX)', 1, 5, 'GPU module; larger share than the boards (placeholder)'),
    L('cpu', 'cpu', 'Main compute boards (RK3588 ×2)', 2, 1.5, 'Two main boards; US credit depends on the open subassembly question'),
    L('lidar', 'sensors', 'Multi-line 3D lidar', 1, 3, 'Chest slot lidar'),
    L('depth', 'sensors', 'RGB-D depth camera', 1, 2, 'Chest slot depth camera'),
    L('rgb', 'sensors', 'RGB cameras', 4, 0.5, 'Interactive, front dual, rear'),
    L('other', 'other', 'Everything else', 1, 3, 'Screen, radios (Wi-Fi/BT/4G/5G/UWB), IMU, mics, touch'),
  ],
  a3: [
    L('jLeg', 'joints', 'Leg joint modules', 12, 2, 'Hips, knees, ankles (6 per leg); stage loads'),
    L('jArm', 'joints', 'Arm joint modules', 14, 1.5, 'Shoulders, elbows, wrists (7 per arm)'),
    L('jNeck', 'joints', 'Neck joint modules', 2, 1.5, 'Head pitch and rotation'),
    L('jWaist', 'joints', 'Waist joint modules', 3, 2, 'Waist roll, yaw, pitch'),
    L('hands', 'joints', 'Dexterous hands (optional)', 2, 8, 'Optional; 6 DOF each on the standard listing'),
    L('frame', 'frame', 'Frame and structure', 1, 9, 'Magnesium/titanium links, TPU covers'),
    L('harness', 'harness', 'Wiring harness', 1, 3, 'Power and data cabling'),
    L('battery', 'battery', 'Dual battery packs', 2, 5, '1152 Wh total, hot-swappable'),
    L('cpu', 'cpu', 'Compute units (MDU + HDU)', 2, 3, 'RK3588 MDU, RK3588S2 HDU'),
    L('stereo', 'sensors', 'Binocular head cameras', 2, 1.5, 'Dual binocular cameras'),
    L('radio', 'other', 'Radios (5G ×2, Wi-Fi, BT, UWB)', 1, 2.5, 'Dual 5G modules, Wi-Fi, Bluetooth, UWB'),
    L('other', 'other', 'Everything else', 1, 2, 'Mic array, shoulder touch, IMU, foot sensors'),
  ],
  d1: [
    L('jLeg', 'joints', 'Leg joint modules (48 N·m)', 12, 1.2, 'Body, thigh, calf joint on each of 4 legs'),
    L('frame', 'frame', 'Frame and structure', 1, 5, 'Aluminum body, plastic shells, feet'),
    L('harness', 'harness', 'Wiring harness', 1, 2, 'Power and CAN to every joint'),
    L('battery', 'battery', 'Battery (43.2 V, 4.6 Ah)', 1, 4, 'Removable pack with BMS'),
    L('dock', 'battery', 'Charging dock and power adapter', 1, 2, 'Standard accessory; counts toward the 4.4 lb test'),
    L('cpu', 'cpu', 'Locomotion and main controller', 1, 4, 'Real-time controller (8-core CPU on D1 Pro)'),
    L('cam', 'sensors', 'Front camera (1080p, 122°)', 1, 1.5, 'Nose camera'),
    L('payload', 'sensors', 'Expansion lidar / depth (optional)', 0, 4, 'Optional payload; set qty to 1 if you fit it'),
    L('radio', 'other', 'Radios (Wi-Fi 5, BT 5.0)', 1, 1, 'Wi-Fi 2.4 GHz 21 dBm, Bluetooth'),
    L('other', 'other', 'Everything else', 1, 1.5, 'IMU, remote, expansion ports'),
  ],
};

export const PRESETS = [
  { name: 'All foreign', tags: [] },
  { name: 'US frame + harness only', tags: ['frame', 'harness'] },
  { name: 'US joints only', tags: ['joints'] },
  { name: '+ frame & harness', tags: ['joints', 'frame', 'harness'] },
  { name: '+ US-built battery & carrier (optimistic)', tags: ['joints', 'frame', 'harness', 'battery', 'cpu'], caveat: 'Optimistic: assumes a US-assembled battery pack (imported cells) and a US carrier board around a foreign module count as fully domestic. That is the open subassembly question.' },
  { name: 'All US', tags: ['joints', 'frame', 'harness', 'battery', 'cpu', 'ai', 'sensors', 'other'] },
];

// Default on first load: the '+ frame & harness' example (US joints, frame, harness).
export const DEFAULT_PRESET = 3;
