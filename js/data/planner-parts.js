// Content for the build planner. Cost shares are an ASSUMED illustration, not AgiBot data.
// Robot faces +Z. Robot's left = +X (appears on the viewer's right when viewed from the front).

export const SUBSYSTEMS = {
  actuation:  { name: 'Actuation (joint modules)', color: '#f08a24' },
  perception: { name: 'Perception sensors',        color: '#2f7cf6' },
  compute:    { name: 'Compute',                   color: '#8b5cf6' },
  power:      { name: 'Power',                     color: '#eab308' },
  structure:  { name: 'Structure',                 color: '#64748b' },
  wiring:     { name: 'Wiring',                    color: '#14b8a6' },
  comms:      { name: 'Radio and safety',          color: '#ec4899' },
};

export const ORIGIN_REC = {
  us:      { name: 'Source in the US first',                color: '#16a34a' },
  foreign: { name: 'Foreign OK within the allowance',       color: '#f59e0b' },
  minor:   { name: 'Small cost share (either origin)',      color: '#9ca3af' },
};

const JOINT_ORIGIN = [
  ['US', 'Few US manufacturers of complete humanoid joint modules exist today. The other route is to manufacture the module yourself in the US. Then its cost counts as manufacturing cost plus allocable overhead, with no profit.'],
  ['China', 'This is the largest supply base for integrated humanoid joints. Estun and Leaderdrive are names a third party reports for AgiBot; they are inferred and unverified. Chinese modules count as foreign.'],
  ['Third country', 'Japan, Korea, Germany, Taiwan, and others make modules and parts. These count as foreign too.'],
];
const JOINT_EXPORT = 'Usually EAR99, unless the joint was specially designed for defense (then ITAR) or the robot is a 2B007 robot. Joint actuators, harmonic drives, and commercial torque sensors are normally EAR99.';
const JOINT_REC = 'Source these in the US first. The joint modules are the largest share of component cost, and a purchased module counts as one whole component. It is domestic or foreign based on where the module itself was made. Buy US-made modules, or manufacture the modules in the US. Whether putting imported subparts together counts as manufacturing in the US depends on the facts, so ask counsel before relying on it.';

function joint(id, label, dof, spec) {
  return {
    id, label: `${label} · ${dof} DOF`, title: `${label} joint modules (${dof} DOF)`,
    sub: 'actuation', rec: 'us', calc: 'joints', dof,
    what: `${dof === 1 ? 'One integrated joint module' : dof + ' integrated joint modules'} at this location. Each module is typically a motor, a reducer, encoders, and drive electronics, sometimes with a torque sensor.`,
    spec: spec,
    origin: JOINT_ORIGIN,
    exportNote: JOINT_EXPORT,
    share: `If the 60% joint share is split evenly by DOF (a simplification), this is about ${(1.5 * dof).toFixed(1)}% of component cost. Assumed, not AgiBot data.`,
    recText: JOINT_REC,
  };
}

const SENSOR_EXPORT = 'EAR99 for ordinary cameras and most automotive or robot lidar. Imaging systems built for military sensors can be controlled.';
const SENSOR_REC = 'Foreign parts are fine here if the joints, frame, harness, battery, and compute carrier are domestic. Keep supplier origin records. A part of unknown origin counts as foreign.';

export const PARTS = [
  // ---- Head / perception
  { id: 'lidar', label: '3D lidar', title: '3D lidar', sub: 'perception', rec: 'foreign', calc: 'sensors', key: true,
    what: 'Spinning or solid-state 3D lidar used for mapping, localization, and obstacle detection.',
    spec: 'A2 Ultra lists a 3D lidar (agibot.com). The model and maker are not published.',
    origin: [['US', 'US-headquartered lidar makers exist, such as Ouster. Check where the unit is actually made: a US brand built abroad still counts as foreign content.'], ['China', 'Hesai and Livox are common choices.'], ['Third country', 'European and Asian makers.']],
    exportNote: SENSOR_EXPORT, share: 'Part of the 8% cameras-and-lidar share (assumed).', recText: SENSOR_REC },
  { id: 'rgbd', label: 'RGB-D depth camera', title: 'RGB-D depth camera', sub: 'perception', rec: 'foreign', calc: 'sensors', key: true,
    what: 'A camera that gives depth plus color. It is used for manipulation and close-range perception.',
    spec: 'A2 Ultra lists an RGB-D camera. A third party reports Orbbec as the depth-camera supplier (inferred, unverified).',
    origin: [['US', 'Intel RealSense is designed in the US and built in Asia, so it counts as foreign content unless it is made in the US.'], ['China', 'Orbbec (reported/inferred for AgiBot, unverified) and others.'], ['Third country', 'Stereolabs ZED (France) and others.']],
    exportNote: SENSOR_EXPORT, share: 'Part of the 8% cameras-and-lidar share (assumed).', recText: SENSOR_REC },
  { id: 'rgb', label: 'RGB camera', title: 'RGB camera', sub: 'perception', rec: 'foreign', calc: 'sensors',
    what: 'A standard color camera for recognition and teleoperation video.',
    spec: 'A2 Ultra lists an RGB camera.',
    origin: [['US', 'US-made camera modules exist but cost more.'], ['China', 'This is the largest module supply base.'], ['Third country', 'Japan, Taiwan, Korea, and Europe.']],
    exportNote: SENSOR_EXPORT, share: 'Part of the 8% cameras-and-lidar share (assumed).', recText: SENSOR_REC },
  { id: 'fisheye', label: 'Fisheye cameras', title: 'Fisheye cameras', sub: 'perception', rec: 'foreign', calc: 'sensors',
    what: 'Wide-angle cameras for all-around situational awareness.',
    spec: 'A2 Ultra lists fisheye cameras. The count and placement are not published, so this model places them on the sides of the head.',
    origin: [['US', 'Limited options.'], ['China', 'Common.'], ['Third country', 'Japan, Taiwan, and Europe.']],
    exportNote: SENSOR_EXPORT, share: 'Part of the 8% cameras-and-lidar share (assumed).', recText: SENSOR_REC },
  { id: 'mic', label: 'Microphone array', title: 'Microphone array', sub: 'perception', rec: 'minor', calc: 'other',
    what: 'A multi-microphone array for voice commands and locating sound.',
    spec: 'A2 Ultra lists a microphone array.',
    origin: [['US', 'Available.'], ['China', 'Common.'], ['Third country', 'Common.']],
    exportNote: 'EAR99 for commercial audio parts.', share: 'Part of the 2% "everything else" bucket (assumed).',
    recText: 'Small cost share. Either origin works. Still record its origin, because unknown origin counts as foreign.' },
  { id: 'face', label: 'Face screen', title: 'Facial display screen', sub: 'perception', rec: 'minor', calc: 'other', key: true,
    what: 'A display used as an expressive face and status indicator.',
    spec: 'A2 Ultra lists a facial screen.',
    origin: [['US', 'Few US display panel makers. A US-built display assembly is possible.'], ['China', 'Common.'], ['Third country', 'Korea, Japan, and Taiwan.']],
    exportNote: 'EAR99 for commercial displays.', share: 'Part of the 2% "everything else" bucket (assumed).',
    recText: 'Small cost share. A foreign display is fine within the allowance.' },
  // ---- Joints
  Object.assign(joint('neck', 'Neck', 2, 'A2 Ultra publishes 2 neck DOF.'), { key: true }),
  joint('shoulderL', 'L shoulder', 3, 'A2 Ultra publishes 7 DOF per arm. The 3-shoulder / 1-elbow / 3-wrist split is a modeling assumption.'),
  joint('elbowL', 'L elbow', 1, 'Part of the published 7 DOF per arm. The split is a modeling assumption.'),
  joint('wristL', 'L wrist', 3, 'Part of the published 7 DOF per arm (includes forearm roll). The split is a modeling assumption.'),
  Object.assign(joint('shoulderR', 'R shoulder', 3, 'A2 Ultra publishes 7 DOF per arm. The 3-shoulder / 1-elbow / 3-wrist split is a modeling assumption.'), { key: true }),
  Object.assign(joint('elbowR', 'R elbow', 1, 'Part of the published 7 DOF per arm. The split is a modeling assumption.'), { key: true }),
  joint('wristR', 'R wrist', 3, 'Part of the published 7 DOF per arm (includes forearm roll). The split is a modeling assumption.'),
  Object.assign(joint('handL', 'L dexterous hand', 6, 'A2 Ultra publishes 6-DOF hands.'), { title: 'Left dexterous hand (6 DOF)', what: 'A dexterous hand with 6 actuated DOF. It usually has small linear or rotary actuators and may have tactile sensing.' }),
  Object.assign(joint('handR', 'R dexterous hand', 6, 'A2 Ultra publishes 6-DOF hands.'), { title: 'Right dexterous hand (6 DOF)', key: true, what: 'A dexterous hand with 6 actuated DOF. It usually has small linear or rotary actuators and may have tactile sensing.' }),
  Object.assign(joint('hipL', 'L hip', 3, 'A2 Ultra publishes 6 DOF per leg. The 3-hip / 1-knee / 2-ankle split is a modeling assumption.'), { key: true }),
  Object.assign(joint('kneeL', 'L knee', 1, 'A2 Ultra publishes a peak knee torque of 270 N·m. A 512 N·m integrated joint is reported elsewhere, not on the official spec table.'), { key: true }),
  joint('ankleL', 'L ankle', 2, 'Part of the published 6 DOF per leg. The split is a modeling assumption.'),
  joint('hipR', 'R hip', 3, 'A2 Ultra publishes 6 DOF per leg. The 3-hip / 1-knee / 2-ankle split is a modeling assumption.'),
  joint('kneeR', 'R knee', 1, 'A2 Ultra publishes a peak knee torque of 270 N·m. A 512 N·m integrated joint is reported elsewhere, not on the official spec table.'),
  Object.assign(joint('ankleR', 'R ankle', 2, 'Part of the published 6 DOF per leg. The split is a modeling assumption.'), { key: true }),
  // ---- Inside the joints
  { id: 'harmonic', label: 'Harmonic drive / reducer (in joints)', title: 'Harmonic drive / reducer (inside every joint module)', sub: 'actuation', rec: 'us', calc: 'joints', inside: true,
    what: 'A strain-wave (harmonic) or planetary reducer that turns motor speed into joint torque. One sits inside each joint module.',
    spec: 'AgiBot does not publish the joint internals. A third party reports Leaderdrive as a supplier (inferred, unverified).',
    origin: [['US', 'Few US-made strain-wave options at humanoid volume.'], ['China', 'Several strain-wave makers, including Leaderdrive (reported/inferred for AgiBot, unverified).'], ['Third country', 'Japanese makers such as Harmonic Drive Systems, plus others. A Japanese unit is still foreign content.']],
    exportNote: 'Usually EAR99, unless it was specially designed for defense (ITAR) or for a 2B007 robot.',
    share: 'Inside the joint-module share. If you buy the joint as one module, the reducer is not counted separately; the module origin decides. Assumed shares only.',
    recText: 'A high-value part inside every joint. If you manufacture the joint modules in the US, the reducer cost is part of your domestic module cost. Track it, because it drives module cost.' },
  { id: 'encoder', label: 'Encoders (in joints)', title: 'Encoders (inside joint modules)', sub: 'actuation', rec: 'minor', calc: 'joints', inside: true,
    what: 'Rotary position sensors on the motor and/or output side of each joint.',
    spec: 'Not published. Joint modules typically have one or two each.',
    origin: [['US', 'Available, mostly at instrument grade.'], ['China', 'Widely sold, optical and magnetic.'], ['Third country', 'Japan and Europe (for example, Heidenhain in Germany). Renishaw has UK and US production.']],
    exportNote: 'EAR99, unless it is a rotary feedback unit specially designed for machine tools at about 0.9 arc-second or better (ECCN 2B006.c). Humanoid joint encoders are usually much coarser than that.',
    share: 'Inside the joint-module share, and small next to the motor and reducer.',
    recText: 'Avoid metrology-grade units you do not need. Count encoders inside the module if you buy the module whole.' },
  { id: 'torque', label: 'Joint torque sensors', title: 'Joint torque sensors', sub: 'actuation', rec: 'minor', calc: 'joints', inside: true,
    what: 'Strain-gauge torque sensors that measure joint load, for compliant control and safety.',
    spec: 'Not published. Some humanoid joints include them and some estimate torque from motor current.',
    origin: [['US', 'US load-cell and torque-sensor firms (for example ATI and FUTEK) sell industrial units, which may not fit a compact joint package.'], ['China', 'Common in humanoid supply chains.'], ['Third country', 'Europe (for example Kistler).']],
    exportNote: 'EAR99 for a commercial joint torque sensor.',
    share: 'Inside the joint-module share. Moderate per joint, but it adds up across many joints.',
    recText: 'If you build modules in the US, a domestic or foreign sensor inside your module does not change the module\u2019s origin. Confirm that with counsel.' },
  // ---- Torso / compute / power
  { id: 'jetson', label: 'NVIDIA Jetson Orin 64 GB', title: 'NVIDIA Jetson Orin 64 GB module', sub: 'compute', rec: 'foreign', calc: 'jetson', inside: true, key: true,
    what: 'The AI and perception computer: a GPU system-on-module mounted on a carrier board in the torso.',
    spec: 'A2 Ultra lists NVIDIA Jetson Orin 64 GB.',
    origin: [['US', 'NVIDIA designs in the US. Check where your specific module is manufactured. Design location does not make a part domestic.'], ['China', 'Not the NVIDIA module. Chinese edge-AI modules exist.'], ['Third country', 'Jetson modules are generally manufactured in Asia. Intel and Qualcomm modules are lower-performance alternatives, and none of them automatically counts as domestic.']],
    exportNote: 'Check NVIDIA\u2019s published export classification (ECCN) for the specific module. A domestic sale of the robot to a US person is not an export of the chip.',
    share: 'Placeholder 8% of the 12% compute share. The GPU module is likely the costliest electronic part.',
    recText: 'Usually left foreign within the allowance, but it is likely the largest electronic cost, so it eats a big part of the 35% (through 2028) or 25% (from 2029) foreign budget. Price it early.' },
  { id: 'cpu', label: 'Main CPU + carrier board', title: '16-core main CPU board and compute carrier', sub: 'compute', rec: 'us', calc: 'cpu', inside: true, key: true,
    what: 'The real-time and control computer, plus the carrier board that hosts the Jetson module and its I/O.',
    spec: 'A2 Ultra lists a 16-core CPU alongside the Jetson Orin.',
    origin: [['US', 'Can be designed and built at US contract manufacturers. A US-assembled carrier does not make the Jetson module itself domestic.'], ['China', 'Common.'], ['Third country', 'Taiwan, Mexico, and others. Mexico counts as foreign for this test.']],
    exportNote: 'Usually EAR99 for a commercial board. Check any high-end processor\u2019s own ECCN if you export it.',
    share: 'Placeholder 4% of the 12% compute share.',
    recText: 'Build this board in the US if you can. Whether a US-built carrier around a foreign Jetson module earns domestic credit depends on the open subassembly question, so treat that credit as optimistic until it is answered in writing. With the battery pack, it takes the worked example from 70% to 82%.' },
  { id: 'imu', label: 'IMU', title: 'Inertial measurement unit (IMU)', sub: 'perception', rec: 'minor', calc: 'other', inside: true, key: true,
    what: 'Accelerometers and gyroscopes used for balance and state estimation. Usually mounted near the pelvis or torso.',
    spec: 'Not listed in the published spec used here. It is standard in walking humanoids and is included as a planning item.',
    origin: [['US', 'US inertial makers (Honeywell, Northrop, EMCORE) sell navigation-grade units, which a balance controller does not need.'], ['China', 'Robot-grade units are common (for example, WitMotion).'], ['Third country', 'Bosch and ST MEMS parts (Europe).']],
    exportNote: 'Normally EAR99 at robot-balance grade. ECCN 7A003 (or 7A103 if missile-related) applies only at navigation grade.',
    share: 'Part of the 2% "everything else" bucket (assumed).',
    recText: 'Buy the robot-grade part. A navigation-grade IMU adds export controls without helping balance control.' },
  { id: 'battery', label: 'Swappable battery pack', title: 'Swappable battery pack (14.4 Ah)', sub: 'power', rec: 'us', calc: 'battery', key: true,
    what: 'A hot-swappable lithium-ion pack in a backpack housing, plus an off-board charger.',
    spec: 'A2 Ultra: 14.4 Ah swappable battery, charger 54.6 V 8 A, walking about 1.5 h+. A third party names CATL as a cell supplier (reported/inferred, unverified).',
    origin: [['US', 'US cell plants exist, but most cells are imported. A pack manufactured in the US can count as one domestic component.'], ['China', 'CATL and BYD (reported/inferred, unverified), and many others.'], ['Third country', 'Korea (LG, Samsung SDI, SK On) and Japan (Panasonic).']],
    exportNote: 'EAR99 as a commercial battery.',
    share: 'Assumed 8% (battery and charger).',
    recText: 'Source in the US: assemble the pack in the US, with the cells, BMS, and housing as one manufactured component.' },
  { id: 'bms', label: 'Power distribution / BMS', title: 'Power distribution board and battery management (BMS)', sub: 'power', rec: 'minor', calc: 'other', inside: true,
    what: 'The battery management system, the main power distribution, the DC-DC converters, and the hardwired e-stop power cut.',
    spec: 'Not published.',
    origin: [['US', 'Easy to build at US contract manufacturers.'], ['China', 'Common.'], ['Third country', 'Common.']],
    exportNote: 'EAR99 for commercial power electronics.',
    share: 'The BMS can sit inside the battery pack component. The power board is in the 2% "everything else" bucket (assumed).',
    recText: 'Build it with the battery pack in the US, so it rides in a domestic component.' },
  { id: 'harness', label: 'Wiring harness', title: 'Wiring harness', sub: 'wiring', rec: 'us', calc: 'harness', key: true,
    what: 'Power and communication cabling (for example EtherCAT or CAN) from the torso to every joint and sensor.',
    spec: 'Not published.',
    origin: [['US', 'Easy to build in the US from commodity wire.'], ['China', 'Common.'], ['Third country', 'Mexico and others. Mexico counts as foreign for this test.']],
    exportNote: 'EAR99.',
    share: 'Assumed 3% (taken from the 5% "other" share).',
    recText: 'Source in the US. It is cheap to make here, and together with the frame it moves the worked example from 60% to about 70%.' },
  { id: 'frame', label: 'Frame / structure', title: 'Frame and structure (links, chassis, covers)', sub: 'structure', rec: 'us', calc: 'frame', key: true,
    what: 'The aluminum and steel limb links, torso chassis, pelvis, and covers.',
    spec: 'A2 Ultra: 169 cm tall, about 69 kg.',
    origin: [['US', 'Can be machined in the US from domestic or imported mill products. A frame you manufacture in the US counts at its manufacturing cost.'], ['China', 'Common.'], ['Third country', 'Common.']],
    exportNote: 'EAR99.',
    share: 'Assumed 7%.',
    recText: 'Source in the US. On its own it is not enough: a US frame plus foreign joints still fails.' },
  { id: 'footforce', label: 'Foot force sensors', title: 'Foot force / contact sensors', sub: 'perception', rec: 'minor', calc: 'other',
    what: 'Load cells or force-sensitive pads in each foot, used to detect ground contact and the center of pressure.',
    spec: 'Not listed in the published spec used here. It is a common humanoid planning item.',
    origin: [['US', 'US load-cell makers.'], ['China', 'Common.'], ['Third country', 'Common.']],
    exportNote: 'EAR99 for commercial load cells.',
    share: 'Part of the 2% "everything else" bucket (assumed).',
    recText: 'Small cost share. Either origin works.' },
  { id: 'estop', label: 'Wireless e-stop radio', title: 'Wireless e-stop receiver / radio module', sub: 'comms', rec: 'minor', calc: 'other', key: true,
    what: 'The receiver for the wireless emergency stop and remote control, plus any Wi-Fi or Bluetooth radios.',
    spec: 'A2 Ultra ships with a wireless e-stop and remote.',
    origin: [['US', 'Available.'], ['China', 'Common.'], ['Third country', 'Common.']],
    exportNote: 'Usually EAR99 for commercial radio modules.',
    share: 'Part of the 2% "everything else" bucket (assumed).',
    recText: 'Radios are why FCC equipment authorization comes up for the robot. That is the authorization the Covered List rule denies to foreign-produced advanced robots, so the whole robot has to pass the 65% / 75% domestic-component test. The module itself is a small cost.' },
];

// Parts that exist only in one size class, plus per-class overrides.
// Compact-class figures come from published AgiBot X2 Ultra specs (agibot.com, store.agibot.com), verified Oct 4, 2026.
PARTS.find(p => p.id === 'fisheye').classes = ['full'];
PARTS.find(p => p.id === 'handL').classes = ['full'];
PARTS.find(p => p.id === 'handR').classes = ['full'];

PARTS.push(Object.assign(joint('waist', 'Waist', 3, 'X2 Ultra publishes 3 waist DOF. The A2 Ultra 40-DOF breakdown lists no waist joints.'), { classes: ['compact'], key: true }));
PARTS.push({ id: 'touch', label: 'Head touch sensor', title: 'Head touch sensor', sub: 'perception', rec: 'minor', calc: 'other', classes: ['compact'],
  what: 'A capacitive or pressure touch area on the head. It is used for interaction: the robot nods or shakes its head when touched.',
  spec: 'X2 Ultra lists a head touch sensor.',
  origin: [['US', 'Available.'], ['China', 'Common.'], ['Third country', 'Common.']],
  exportNote: 'EAR99 for commercial touch sensors.', share: 'Part of the "everything else" bucket (assumed).',
  recText: 'Small cost share. Either origin works.' });

export const OVERRIDES = {
  compact: {
    lidar:  { spec: 'X2 Ultra lists a multi-line 3D lidar (standard on Ultra).' },
    rgbd:   { spec: 'X2 Ultra lists an RGB-D camera. A third party reports Orbbec as an AgiBot depth-camera supplier (inferred, unverified).' },
    rgb:    { label: 'RGB cameras', title: 'RGB cameras (interactive, front dual, rear)', spec: 'X2 Ultra lists an interactive RGB camera, front dual RGB cameras, and a rear RGB camera.' },
    mic:    { spec: 'X2 Ultra lists a microphone array, a wireless microphone, and a speaker.' },
    face:   { label: 'Interactive screen', spec: 'X2 Ultra lists an interactive screen and lighting effects.' },
    neck:   { spec: 'X2 Ultra (new version) publishes 2 neck DOF. The earlier X2 Ultra has 1.' },
    shoulderL: { spec: 'X2 Ultra publishes 7 DOF per arm. The 3-1-3 split is a modeling assumption.' },
    shoulderR: { spec: 'X2 Ultra publishes 7 DOF per arm. The 3-1-3 split is a modeling assumption.' },
    elbowL: { spec: 'Part of the published 7 DOF per arm (X2 Ultra).' }, elbowR: { spec: 'Part of the published 7 DOF per arm (X2 Ultra).' },
    wristL: { spec: 'Arm joint; X2 has 30 total actuated DoF per AgiBot\u2019s developer docs (per-arm split is a modeling assumption). Hands are optional end-effectors, not in the 30.' },
    wristR: { spec: 'Arm joint; X2 has 30 total actuated DoF per AgiBot\u2019s developer docs (per-arm split is a modeling assumption). Hands are optional end-effectors, not in the 30.' },
    hipL:   { spec: 'X2 Ultra publishes 6 DOF per leg. The 3-1-2 split is a modeling assumption.' },
    hipR:   { spec: 'X2 Ultra publishes 6 DOF per leg. The 3-1-2 split is a modeling assumption.' },
    kneeL:  { spec: 'X2 Ultra publishes a peak joint torque of 120 N·m. That is a robot-wide figure, not a knee-specific one.' },
    kneeR:  { spec: 'X2 Ultra publishes a peak joint torque of 120 N·m. That is a robot-wide figure, not a knee-specific one.' },
    ankleL: { spec: 'Part of the published 6 DOF per leg (X2 Ultra).' }, ankleR: { spec: 'Part of the published 6 DOF per leg (X2 Ultra).' },
    jetson: { label: 'NVIDIA Jetson Orin NX', title: 'NVIDIA Jetson Orin NX module', spec: 'X2 Ultra lists an Orin NX (157 TOPS) high-performance board.',
              what: 'The AI and perception computer: a Jetson Orin NX system-on-module on a carrier board in the torso.' },
    cpu:    { label: 'Main compute (RK3588 ×2)', title: 'Main compute boards (RK3588 ×2)', spec: 'X2 Ultra lists two RK3588 main compute boards.',
              origin: [['US', 'Boards can be built at US contract manufacturers. The RK3588 is a Rockchip (China) processor. Under the Buy American method, the board is the component, and its origin is where the board was manufactured. Confirm with counsel.'], ['China', 'RK3588 boards are widely made in China.'], ['Third country', 'Taiwan, Mexico, and others. Mexico counts as foreign for this test.']] },
    battery:{ title: 'Swappable battery pack (~500 Wh)', spec: 'X2 Ultra: about 500 Wh, swappable or direct charging, charger 54.6 V 10 A, about 2 h at 0.5 m/s walking, charging ≤1.5 h.' },
    estop:  { label: 'Radios (Wi-Fi / BT / 4G/5G / UWB)', title: 'Radio modules (Wi-Fi, Bluetooth, 4G/5G, UWB)', spec: 'X2 Ultra lists Wi-Fi, Bluetooth, and a 4G/5G module. The new version adds UWB. A handheld controller is included or optional, depending on the listing.',
              what: 'Wireless links for the app, the remote, cellular, and positioning.' },
    frame:  { spec: 'X2 Ultra: 1310 × 460 × 210 mm, about 39 kg, arm reach 558 mm without the end-effector.' },
  },
};

export const KEYSPEC = {
  full: { lidar: '3D', rgbd: 'depth + color', rgb: 'color', fisheye: 'wide-angle', mic: 'array', face: 'display',
    kneeL: '270 N·m peak', kneeR: '270 N·m peak', harmonic: 'in every joint', encoder: 'in every joint', torque: 'in joints',
    jetson: '64 GB', cpu: '16-core CPU', imu: 'balance grade', battery: '14.4 Ah · swappable', bms: 'power', harness: 'power + data',
    frame: '169 cm · ~69 kg', footforce: 'contact', estop: 'radio · FCC-relevant' },
  compact: { lidar: 'multi-line 3D', rgbd: 'depth + color', rgb: 'interactive + front dual + rear', mic: 'array + speaker', face: 'screen + lights',
    kneeL: '120 N·m peak (robot)', kneeR: '120 N·m peak (robot)', harmonic: 'in every joint', encoder: 'in every joint', torque: 'in joints',
    jetson: 'Orin NX · 157 TOPS', cpu: 'RK3588 ×2', imu: 'balance grade', battery: '~500 Wh · swappable', bms: 'power', harness: 'power + data',
    frame: '131 cm · ~39 kg', footforce: 'contact', estop: 'FCC-relevant', touch: 'head' },
};

// =====================================================================================
// Planner line mapping. Each part maps to one line in the parts table (bom.js) for its platform.
// '@joints' means the part sits inside every joint module, so it follows all joint lines.
const LINE = {
  neck: 'jNeck', waist: 'jWaist',
  shoulderL: 'jArm', shoulderR: 'jArm', elbowL: 'jArm', elbowR: 'jArm', wristL: 'jArm', wristR: 'jArm',
  hipL: 'jLeg', hipR: 'jLeg', kneeL: 'jLeg', kneeR: 'jLeg', ankleL: 'jLeg', ankleR: 'jLeg',
  handL: 'hands', handR: 'hands', harmonic: '@joints', encoder: '@joints', torque: '@joints',
  frame: 'frame', harness: 'harness', battery: 'battery', bms: 'battery', cpu: 'cpu', jetson: 'ai',
  lidar: 'lidar', rgbd: 'depth', rgb: 'rgb', fisheye: 'fisheye',
  mic: 'other', face: 'other', imu: 'other', footforce: 'other', estop: 'other', touch: 'other',
};
for (const p of PARTS) if (LINE[p.id]) p.calc = LINE[p.id];

// ---- A3-class (stage humanoid) and D1-class (quadruped) parts
const A3_IDS = ['neck', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'wristL', 'wristR', 'handL', 'handR', 'waist',
  'hipL', 'hipR', 'kneeL', 'kneeR', 'ankleL', 'ankleR', 'harmonic', 'encoder', 'torque', 'cpu', 'imu', 'battery', 'bms',
  'harness', 'frame', 'footforce', 'estop', 'mic'];
const D1_IDS = ['harmonic', 'encoder', 'cpu', 'imu', 'battery', 'bms', 'harness', 'frame', 'estop', 'rgb'];
for (const p of PARTS) {
  if (!p.classes) p.classes = ['full', 'compact'];
  if (A3_IDS.includes(p.id)) p.classes.push('a3');
  if (D1_IDS.includes(p.id)) p.classes.push('d1');
}

PARTS.push({ id: 'stereo', label: 'Binocular cameras', title: 'Dual binocular head cameras', sub: 'perception', rec: 'foreign', calc: 'stereo', classes: ['a3'], key: true,
  what: 'Two stereo camera pairs behind the head shell, used for depth, navigation, and interaction.',
  spec: 'A3 lists dual binocular cameras on the head; the HDU camera is 1920×1536 at 30 fps (open.agibot.com).',
  origin: [['US', 'Few US-made stereo modules; US-assembled modules around imported sensors are possible.'], ['China', 'Common.'], ['Third country', 'Japan, Taiwan, Korea, and Europe.']],
  exportNote: SENSOR_EXPORT, share: 'Planner line: binocular head cameras.', recText: SENSOR_REC });
PARTS.push({ id: 'shtouch', label: 'Shoulder touch sensors', title: 'Shoulder touch sensing', sub: 'perception', rec: 'minor', calc: 'other', classes: ['a3'], key: true,
  what: 'Touch-sensitive areas on the shoulders used for interaction (tap to get the robot\u2019s attention).',
  spec: 'A3 lists shoulder touch sensing (agibot.com/products/A3). The sensor type is not published.',
  origin: [['US', 'Available.'], ['China', 'Common.'], ['Third country', 'Common.']],
  exportNote: 'EAR99 for commercial touch sensors.', share: 'Part of the "everything else" line (assumed).',
  recText: 'Small cost share. Either origin works. Record its origin anyway, because unknown origin counts as foreign.' });

const QUAD_JOINT_REC = 'Source these in the US first. The 12 leg modules are the largest cost block in a quadruped. Quadrupeds are expressly covered by the FCC rule, so a D1-class robot faces the same >65% / >75% test as a humanoid.';
for (const [id, name, title, key] of [['legFL', 'FL leg', 'Front-left leg', true], ['legFR', 'FR leg', 'Front-right leg', true], ['legRL', 'RL leg', 'Rear-left leg', true], ['legRR', 'RR leg', 'Rear-right leg', false]]) {
  PARTS.push(Object.assign(joint(id, name, 3, 'D1 Ultra publishes 12 DOF, 3 per leg, with a 48 N·m maximum joint torque and dual-encoder joints. Ranges: body −28° to +28°, thigh −170° to −66°, calf +35° to +156°.'), {
    title: `${title} joint modules (3 DOF)`, calc: 'jLeg', classes: ['d1'], key,
    what: 'Three joint modules per leg: body (abduction), thigh (hip flexion), and calf (knee, usually driven through a linkage). Each is a motor, reducer, dual encoders, and a driver.',
    recText: QUAD_JOINT_REC }));
}
PARTS.push({ id: 'dock', label: 'Charging dock', title: 'Charging dock and power adapter', sub: 'power', rec: 'minor', calc: 'dock', classes: ['d1'], key: true,
  what: 'The standard charging dock and power adapter that ship with the robot.',
  spec: 'D1 Ultra lists a power adapter and a charging dock as standard accessories.',
  origin: [['US', 'Easy to build in the US.'], ['China', 'Common.'], ['Third country', 'Common.']],
  exportNote: 'EAR99.', share: 'Planner line: charging dock (assumed cost).',
  recText: 'The FCC definition counts the combined weight of the robot and any dock or ground station toward the 4.4 lb threshold. At 16 kg the robot is over it either way. Whether a separately sold dock is a component of the robot for the cost test is a question for counsel.' });
PARTS.push({ id: 'payload', label: 'Expansion payload', title: 'Expansion payload (3D lidar / depth camera / RTK / 4G)', sub: 'perception', rec: 'foreign', calc: 'payload', classes: ['d1'], key: true,
  what: 'Optional add-on modules on the back rail: 3D lidar, depth camera, RTK, a 4G/5G module, or an image-transmission module.',
  spec: 'D1 Ultra lists Ethernet ×1, USB ×2, power ×2, SBUS ×1, and UART ×1 expansion ports and supports 3D lidar, depth camera, RTK, and 4G modules. None of these is standard.',
  origin: [['US', 'US-made options exist for some payloads. Check where each unit is made.'], ['China', 'Common.'], ['Third country', 'Common.']],
  exportNote: SENSOR_EXPORT, share: 'Planner line: optional payload. Quantity defaults to 0.',
  recText: 'If you ship the robot with a payload, it is a component and counts in the test. An RF payload such as a 4G module is also a radio for FCC authorization.' });

Object.assign(OVERRIDES, {
  a3: {
    neck: { spec: 'A3 publishes 2 neck DOF: head pitch −15° to 30°, rotation ±90°.' },
    shoulderL: { spec: 'A3 publishes 7 DOF per arm: shoulder pitch ±170°, roll ±91°, yaw ±160°.' },
    shoulderR: { spec: 'A3 publishes 7 DOF per arm: shoulder pitch ±170°, roll ±91°, yaw ±160°.' },
    elbowL: { spec: 'A3 elbow pitch −60° to 140°. Rated load 5 kg per arm.' }, elbowR: { spec: 'A3 elbow pitch −60° to 140°. Rated load 5 kg per arm.' },
    wristL: { spec: 'A3 wrist roll ±33°, pitch ±93°, yaw ±160°.' }, wristR: { spec: 'A3 wrist roll ±33°, pitch ±93°, yaw ±160°.' },
    handL: { title: 'Left dexterous hand (optional, 6 DOF)', spec: 'A3 dexterous hands are optional: 6 DOF each on the standard listing, with Agile 2026 (4 DOF) and Professional 2026 (13 DOF) options. Not in the 31 DOF.' },
    handR: { title: 'Right dexterous hand (optional, 6 DOF)', spec: 'A3 dexterous hands are optional: 6 DOF each on the standard listing, with Agile 2026 (4 DOF) and Professional 2026 (13 DOF) options. Not in the 31 DOF.' },
    waist: { spec: 'A3 publishes 3 waist DOF: roll ±20°, yaw ±150°, pitch ±30°.' },
    hipL: { spec: 'A3 publishes 6 DOF per leg: hip roll −60° to 100°, yaw ±158°, pitch −168° to 154°.' },
    hipR: { spec: 'A3 publishes 6 DOF per leg: hip roll −60° to 100°, yaw ±158°, pitch −168° to 154°.' },
    kneeL: { spec: 'A3 knee pitch −10° to 140°. AgiBot does not publish knee torque; a retailer lists 320 N·m (planning assumption).' },
    kneeR: { spec: 'A3 knee pitch −10° to 140°. AgiBot does not publish knee torque; a retailer lists 320 N·m (planning assumption).' },
    ankleL: { spec: 'A3 ankle pitch −52° to 30°, roll ±20°.' }, ankleR: { spec: 'A3 ankle pitch −52° to 30°, roll ±20°.' },
    cpu: { label: 'Compute (MDU + HDU)', title: 'Compute units: MDU (RK3588) and HDU (RK3588S2)', spec: 'A3 MDU: RK3588, 8-core, 16 GB, 256 GB. HDU: RK3588S2, 8-core, 16 GB, 128 GB (open.agibot.com).',
      what: 'Two computers: the MDU for main computing and device expansion, and the HDU for interaction, the head cameras, and the network link.',
      origin: [['US', 'Boards can be built at US contract manufacturers around the Rockchip processor. The board is the component; confirm origin treatment with counsel.'], ['China', 'RK3588 boards are widely made in China.'], ['Third country', 'Taiwan, Mexico, and others.']] },
    battery: { label: 'Dual battery packs', title: 'Dual hot-swappable battery packs (1152 Wh)', spec: 'A3: dual battery packs, 1152 Wh total, full-tab cells, up to 10 h, charge ≤2 h, about 10 s swap.' },
    estop: { label: 'Radios (5G ×2 / Wi-Fi / BT / UWB)', title: 'Radio modules: dual 5G, Wi-Fi, Bluetooth, UWB', calc: 'radio',
      spec: 'A3 lists dual-module 5G with dual SIM (eSIM + card), Wi-Fi, Bluetooth, and standard UWB positioning (<±10 cm).',
      what: 'Cellular, Wi-Fi, Bluetooth, and UWB radios for connectivity and fleet positioning.' },
    mic: { spec: 'A3 lists 360° omnidirectional pickup with multi-array microphones.' },
    frame: { spec: 'A3: 173 × 52 × 30 cm, about 55 kg. Magnesium alloy, titanium alloy, and TPU.' },
    imu: { spec: 'Not listed in AgiBot\u2019s A3 spec. Standard in walking humanoids (planning assumption).' },
    footforce: { spec: 'Not listed in AgiBot\u2019s A3 spec (planning assumption).' },
  },
  d1: {
    harmonic: { label: 'Reducers (in joints)', title: 'Joint reducers (inside every leg joint module)', spec: 'AgiBot does not publish the reducer type. Quadruped joints usually use planetary gearboxes (planning assumption).' },
    encoder: { label: 'Dual encoders (in joints)', title: 'Dual encoders (inside every leg joint module)', spec: 'D1 Ultra lists dual-encoder joint control with no zero-position calibration.' },
    cpu: { label: 'Main controller', title: 'Locomotion and main controller', spec: 'The D1 Ultra sheet does not list compute. D1 Pro/Edu list a high-performance 8-core CPU (agibot.com).',
      what: 'The real-time gait controller and main computer, which runs the reinforcement-learning locomotion policy.' },
    imu: { spec: 'D1 Ultra lists an IMU as standard.' },
    battery: { label: 'Battery (43.2 V)', title: 'Battery module (43.2 V, 4.6 Ah)', spec: 'D1 Ultra: 43.2 V, 4.6 Ah rated (5 Ah nominal), 1–2 h, about 1 h charge (10–90%), 6 ±1 km range.' },
    estop: { label: 'Radios (Wi-Fi / BT)', title: 'Radio modules (Wi-Fi 5, Bluetooth 5.0)', calc: 'radio',
      spec: 'D1 Ultra lists Wi-Fi 5 on 2.4 GHz at 21 dBm and Bluetooth 5.0, with real-time image transmission and a screen remote control.',
      what: 'The Wi-Fi and Bluetooth links to the screen remote and the app.' },
    frame: { spec: 'D1 Ultra: 630 × 360 × 420 mm standing, 670 × 435 × 145 mm lying, 16 kg with battery, IP54, aluminum alloy with high-strength engineering plastic.',
      recText: 'Source in the US. Quadrupeds are expressly covered by the FCC rule (the definition names humanoid robots and quadrupeds), so the whole robot must pass the >65% / >75% test.' },
    rgb: { label: 'Front camera', title: 'Front camera (1920×1080, DFOV 122°)', calc: 'cam', spec: 'D1 Ultra lists a 1920×1080 camera with DFOV 122°, HFOV 111°, VFOV 70°.' },
  },
});
PARTS.find(p => p.id === 'estop').calc = 'other';

Object.assign(KEYSPEC, {
  a3: { kneeL: 'knee −10°–140°', kneeR: 'knee −10°–140°', harmonic: 'in every joint', encoder: 'in every joint', torque: 'in joints',
    cpu: 'RK3588 + RK3588S2', imu: 'balance grade', battery: '1152 Wh · dual swap', bms: 'power', harness: 'power + data',
    frame: '173 cm · ~55 kg', footforce: 'contact', estop: 'FCC-relevant', mic: '360° array', stereo: '2 × stereo', shtouch: 'interaction',
    handL: 'optional', handR: 'optional' },
  d1: { harmonic: 'in every joint', encoder: 'dual, no calibration', cpu: '8-core (D1 Pro)', imu: 'standard',
    battery: '43.2 V · 4.6 Ah', bms: 'power', harness: 'power + CAN', frame: '16 kg · IP54', estop: 'Wi-Fi 5 · BT 5.0 · FCC-relevant',
    rgb: '1080p · 122°', dock: 'standard', payload: 'optional', legFL: '48 N·m max', legFR: '48 N·m max', legRL: '48 N·m max', legRR: '48 N·m max' },
});
