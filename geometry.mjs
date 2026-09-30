const rad = degrees => degrees * Math.PI / 180;
const deg = radians => radians * 180 / Math.PI;

export function heightSolution({eyeHeight, centerHeight, distance, gaze, tolerance, offset, bodyHeight, tilt, sideAngle = 0}) {
  const values = [eyeHeight, centerHeight, distance, gaze, tolerance, offset, bodyHeight, tilt, sideAngle];
  if (!values.every(Number.isFinite) || distance <= 0 || bodyHeight <= 0 || tolerance < 0 || Math.abs(gaze) + tolerance >= 89) {
    throw new RangeError('Invalid height geometry');
  }
  const rise = centerHeight - eyeHeight;
  const target = eyeHeight + distance * Math.tan(rad(gaze));
  const verticalSpan = bodyHeight * Math.cos(rad(tilt));
  const actualGaze = deg(Math.atan2(rise, distance));
  const screenFacingDistance = distance * Math.cos(rad(sideAngle));
  const aimTilt = deg(Math.atan2(rise, screenFacingDistance));
  const distance3d = Math.hypot(distance, rise);
  const dot = (screenFacingDistance * Math.cos(rad(tilt)) + rise * Math.sin(rad(tilt))) / distance3d;
  return {
    target, targetMount: target - offset,
    low: eyeHeight + distance * Math.tan(rad(gaze - tolerance)),
    high: eyeHeight + distance * Math.tan(rad(gaze + tolerance)),
    actualGaze, gazeDeviation: actualGaze - gaze, aimTilt,
    distance3d, incidence: deg(Math.acos(Math.max(-1, Math.min(1, dot)))),
    bottom: centerHeight - verticalSpan / 2,
    top: centerHeight + verticalSpan / 2,
    withinPreference: Math.abs(actualGaze - gaze) <= tolerance + 1e-8,
  };
}

export function tvPoint(pose, centerHeight, tilt, along, up, depth) {
  const a = pose.a, b = rad(tilt), ca = Math.cos(a), sa = Math.sin(a);
  const cb = Math.cos(b), sb = Math.sin(b);
  return [
    pose.x + along * ca - up * sb * sa - depth * cb * sa,
    pose.y + along * sa + up * sb * ca + depth * cb * ca,
    centerHeight + up * cb - depth * sb,
  ];
}

export function tvCorners(pose, centerHeight, tilt, width, height, depth) {
  return [-1, 1].flatMap(s => [-1, 1].flatMap(t => [-1, 1].map(v =>
    tvPoint(pose, centerHeight, tilt, s * width / 2, t * height / 2, v * depth / 2)
  )));
}

export function roomClearances(corners) {
  return {
    wall: Math.min(...corners.map(p => p[1])),
    sideWall: Math.min(...corners.map(p => p[0])),
    floor: Math.min(...corners.map(p => p[2])),
  };
}

export function project(point, yaw = -35, elevation = 30) {
  const y = rad(yaw), e = rad(elevation), [x, depth, z] = point;
  const horizontal = x * Math.cos(y) - depth * Math.sin(y);
  const away = x * Math.sin(y) + depth * Math.cos(y);
  return [horizontal, away * Math.sin(e) - z * Math.cos(e), away * Math.cos(e) + z * Math.sin(e)];
}
