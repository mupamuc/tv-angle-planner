import {heightSolution, tvPoint, tvCorners, roomClearances, project} from './geometry.mjs';

const $ = id => document.getElementById(id);
const planRoot = $('tv-angle-calculator');
const f = value => value.toFixed(1).replace('.', ',');
const degrees = value => value * 180 / Math.PI;
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let plan = null, solution = null, current = null, selectedTitle = '';
let previousMode = 'center';

function readPlan() {
  plan = planRoot.dataset.plan ? JSON.parse(planRoot.dataset.plan) : null;
  const select = $('height-scenario');
  selectedTitle = select.selectedOptions[0]?.dataset.title || selectedTitle;
  select.innerHTML = '';
  if (plan) plan.rows.forEach((row, i) => {
    const option = document.createElement('option');
    option.value = i;
    option.dataset.title = row.title;
    option.textContent = row.title + (row.ok ? '' : ' — НЕДОСТУПНО');
    select.appendChild(option);
  });
  const index = plan?.rows.findIndex(row => row.title === selectedTitle) ?? -1;
  select.value = index >= 0 ? index : 0;
  update();
}

function fail(message) {
  solution = null; current = null;
  $('height-error').textContent = message;
  $('height-results').innerHTML = '';
  $('height-status').textContent = '';
  $('scene-status').textContent = 'Объёмная схема появится после ввода корректных параметров.';
  $('scene-status').className = '';
  $('room-scene').innerHTML = '';
  $('apply-height').disabled = true;
  $('aim-screen').disabled = true;
}

function update() {
  const mode = $('height-mode').value;
  $('center-height-field').hidden = mode !== 'center';
  $('mount-height-field').hidden = mode !== 'mount';
  const ids = ['eye-height', 'mount-offset', 'gaze-angle', 'gaze-tolerance', 'screen-tilt', mode === 'center' ? 'center-height' : 'mount-height'];
  if (!plan || !plan.rows.length) return fail('Сначала заполните параметры телевизора и кронштейна выше.');
  if (ids.some(id => !$(id).value || !$(id).checkValidity())) return fail('Введите числа в пределах диапазонов полей высоты.');
  const eye = +$('eye-height').value, offset = +$('mount-offset').value;
  const center = mode === 'center' ? +$('center-height').value : +$('mount-height').value + offset;
  const mount = mode === 'mount' ? +$('mount-height').value : center - offset;
  if (center <= 0 || center > 400 || mount <= 0 || mount > 400) return fail('Высота центра ТВ и крепления должна быть больше 0 и не выше 400 см. Проверьте смещение.');
  const row = plan.rows[+$('height-scenario').value];
  if (!row) return fail('Выберите положение телевизора.');
  const tilt = +$('screen-tilt').value;
  solution = heightSolution({eyeHeight: eye, centerHeight: center, distance: row.d, gaze: +$('gaze-angle').value, tolerance: +$('gaze-tolerance').value, offset, bodyHeight: plan.H, tilt, sideAngle: degrees(row.e)});
  const corners = tvCorners(row, center, tilt, plan.W, plan.H, plan.T);
  const clearance = roomClearances(corners);
  current = {eye, offset, center, mount, row, tilt, corners, clearance};
  $('height-error').textContent = '';
  const metric = (label, value, extra) => `<div class="height-metric"><span>${label}</span><strong>${value}</strong><small>${extra}</small></div>`;
  $('height-results').innerHTML =
    metric('Центр под желаемый взгляд', f(solution.target) + ' см', 'Диапазон: ' + f(solution.low) + '–' + f(solution.high) + ' см') +
    metric('Центр крепления под эту высоту', f(solution.targetMount) + ' см', 'Смещение центра ТВ: ' + (offset > 0 ? '+' : '') + f(offset) + ' см') +
    metric('Текущее направление взгляда', f(solution.actualGaze) + '°', 'В плане: ' + f(row.d) + ' см · в пространстве: ' + f(solution.distance3d) + ' см');
  const limits = [];
  if (solution.target <= 0 || solution.target > 400 || solution.targetMount <= 0 || solution.targetMount > 400) limits.push('Расчётная высота вне диапазона 1–400 см; измените желаемый угол или положение.');
  if (clearance.floor < 0) limits.push('Корпус пересекает пол на ' + f(-clearance.floor) + ' см.');
  const physical = [Math.min(...corners.map(p => p[2])), Math.max(...corners.map(p => p[2]))];
  $('height-status').textContent =
    (solution.withinPreference ? 'Текущая высота входит в выбранный вами диапазон.' : 'Центр стоит ' + f(Math.abs(solution.gazeDeviation)) + '° ' + (solution.gazeDeviation > 0 ? 'выше' : 'ниже') + ' желаемого направления взгляда.') +
    ' Центр ТВ: ' + f(center) + ' см; крепление: ' + f(mount) + ' см. Нижняя точка корпуса: ' + f(physical[0]) + ' см, верхняя: ' + f(physical[1]) + ' см. Для направления экрана к глазам по вертикали нужен наклон ' + f(solution.aimTilt) + '° ' + (solution.aimTilt >= 0 ? 'вниз' : 'вверх') + '. ' + limits.join(' ');
  $('height-status').className = limits.length ? 'warning' : '';
  $('apply-height').disabled = limits.some(message => message.startsWith('Расчётная'));
  const targetCorners = tvCorners(row, solution.target, tilt, plan.W, plan.H, plan.T);
  if (roomClearances(targetCorners).floor < 0) {
    $('apply-height').disabled = true;
    $('height-status').textContent += ' При рассчитанной высоте корпус окажется ниже пола; увеличьте желаемый угол или измените размеры.';
    $('height-status').className = 'warning';
  }
  $('aim-screen').disabled = solution.aimTilt < -20 || solution.aimTilt > 30;
  if ($('aim-screen').disabled) $('height-status').textContent += ' Этот наклон вне диапазона модели −20…30°.';
  const verified = Math.abs(plan.W - 122.5) < .001 && Math.abs(plan.H - 74) < .001 && Math.abs(plan.T - 5.6) < .001 && plan.D === 55;
  $('scene-model').textContent = verified ? 'Philips 55OLED910 · корпус без ножек' : 'Телевизор с размерами из калькулятора';
  $('scene-dimensions').textContent = f(plan.W) + ' × ' + f(plan.H) + ' × ' + f(plan.T) + ' см (ширина × высота × глубина)';
  const issues = [];
  if (!row.ok) issues.push('Выбран потенциал, который недоступен при текущем вылете и геометрии сверху.');
  if (clearance.wall < 2 - .001) issues.push(clearance.wall < 0 ? 'Наклонённый корпус пересекает стену на ' + f(-clearance.wall) + ' см.' : 'До стены ' + f(clearance.wall) + ' см — меньше зазора 2 см.');
  if (clearance.sideWall < 2 - .001) issues.push(clearance.sideWall < 0 ? 'Корпус пересекает соседнюю стену на ' + f(-clearance.sideWall) + ' см.' : 'До соседней стены меньше 2 см.');
  if (clearance.floor < 0) issues.push('Корпус пересекает пол.');
  $('scene-status').textContent = (issues.length ? 'НЕДОСТУПНО. ' + issues.join(' ') + ' ' : 'ДОСТУПНО по геометрии корпуса. ') + 'Взгляд сбоку: ' + f(degrees(row.e)) + '°; вверх: ' + f(solution.actualGaze) + '°; суммарный угол к нормали экрана: ' + f(solution.incidence) + '°. Реальные ограничения кронштейна проверяются отдельно.';
  $('scene-status').className = issues.length ? 'warning' : '';
  current.blocked = issues.length > 0;
  renderScene();
}

function renderScene() {
  if (!current || !plan) return;
  const {row, eye, center, mount, tilt, corners, blocked} = current;
  const yaw = +$('camera-yaw').value, elevation = +$('camera-elevation').value;
  const roomX = Math.max(plan.A + 50, ...corners.map(p => p[0] + 30));
  const roomY = Math.max(plan.B + 50, ...corners.map(p => p[1] + 30));
  const roomZ = Math.max(230, center + plan.H / 2 + 30, eye + 30, mount + 20);
  const all = [[0,0,0],[roomX,0,0],[0,roomY,0],[roomX,roomY,0],[0,0,roomZ],[roomX,0,roomZ],[0,roomY,roomZ], ...corners, [0,plan.B,eye]];
  const projected = all.map(point => project(point,yaw,elevation));
  const minX = Math.min(...projected.map(p => p[0])), maxX = Math.max(...projected.map(p => p[0]));
  const minY = Math.min(...projected.map(p => p[1])), maxY = Math.max(...projected.map(p => p[1]));
  const scale = Math.min(770 / (maxX - minX), 470 / (maxY - minY));
  const px = point => {
    const p = project(point,yaw,elevation);
    return [95 + (770 - (maxX-minX)*scale)/2 + (p[0]-minX)*scale, 75 + (470-(maxY-minY)*scale)/2 + (p[1]-minY)*scale];
  };
  const pair = point => px(point).map(n => n.toFixed(2)).join(',');
  const polygon = (points,fill,stroke='#b9cbd6',opacity=1) => `<polygon points="${points.map(pair).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="1.4" opacity="${opacity}"/>`;
  const line = (a,b,color='#6f859a',width=2,dash='') => `<line x1="${px(a)[0]}" y1="${px(a)[1]}" x2="${px(b)[0]}" y2="${px(b)[1]}" stroke="${color}" stroke-width="${width}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
  const label = (point,text,dx=8,dy=-7) => `<text x="${px(point)[0]+dx}" y="${px(point)[1]+dy}">${esc(text)}</text>`;
  let svg = '<defs><linearGradient id="tv-face" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#163b52"/><stop offset="1" stop-color="#061826"/></linearGradient></defs>';
  svg += '<text class="scene-title" x="26" y="30">' + esc(row.title) + '</text>';
  svg += polygon([[0,0,0],[roomX,0,0],[roomX,roomY,0],[0,roomY,0]],'#e9f0f4');
  const step = Math.max(25, Math.ceil(Math.max(roomX,roomY)/15/25)*25);
  for(let x=step;x<roomX;x+=step) svg += line([x,0,0],[x,roomY,0],'#d0dde5',1);
  for(let y=step;y<roomY;y+=step) svg += line([0,y,0],[roomX,y,0],'#d0dde5',1);
  svg += polygon([[0,0,0],[roomX,0,0],[roomX,0,roomZ],[0,0,roomZ]],'#dde8ee','#b2c4d0',.45);
  svg += polygon([[0,0,0],[0,roomY,0],[0,roomY,roomZ],[0,0,roomZ]],'#e7eff4','#b2c4d0',.35);
  svg += line([0,0,0],[0,0,roomZ],'#7e94a5');
  const eyePoint = [0,plan.B,eye], centerPoint = [row.x,row.y,center];
  svg += line([0,plan.B,0],eyePoint,'#a77a5a',2,'5 5');
  svg += line(eyePoint,centerPoint,'#b85c1d',2,'7 5');
  svg += polygon([[plan.A-7,0,mount-12],[plan.A+7,0,mount-12],[plan.A+7,0,mount+12],[plan.A-7,0,mount+12]],'#748b9c');
  const back = tvPoint(row,center,tilt,0,0,-plan.T/2);
  const middle = [(plan.A+back[0])/2,back[1]*.4,mount];
  svg += line([plan.A,0,mount],middle,'#61798b',6) + line(middle,back,'#61798b',6);
  const at = (u,v,d) => tvPoint(row,center,tilt,u*plan.W/2,v*plan.H/2,d*plan.T/2);
  const faceDefinitions = [
    {points:[at(-1,-1,-1),at(1,-1,-1),at(1,1,-1),at(-1,1,-1)],color:'#253747'},
    {points:[at(-1,-1,-1),at(-1,-1,1),at(-1,1,1),at(-1,1,-1)],color:'#384c5b'},
    {points:[at(1,-1,-1),at(1,-1,1),at(1,1,1),at(1,1,-1)],color:'#384c5b'},
    {points:[at(-1,1,-1),at(1,1,-1),at(1,1,1),at(-1,1,1)],color:'#526977'},
    {points:[at(-1,-1,1),at(1,-1,1),at(1,1,1),at(-1,1,1)],color:'url(#tv-face)'},
  ];
  faceDefinitions.sort((a,b) => {
    const depth = face => face.points.reduce((sum,p) => sum+project(p,yaw,elevation)[2],0)/face.points.length;
    return depth(a)-depth(b);
  });
  for (const face of faceDefinitions) svg += polygon(face.points,face.color,blocked?'#bd2028':'#087ea4');
  // Approximate front styling; only the outer body dimensions are authoritative.
  const frontFacing = project([ -Math.sin(row.a)*Math.cos(tilt*Math.PI/180), Math.cos(row.a)*Math.cos(tilt*Math.PI/180), -Math.sin(tilt*Math.PI/180)],yaw,elevation)[2] > 0;
  if(frontFacing) {
    svg += polygon([at(-.94,-.76,1.03),at(.94,-.76,1.03),at(.94,.94,1.03),at(-.94,.94,1.03)],'#16415a','#40637a');
    svg += polygon([at(-.97,-.97,1.04),at(.97,-.97,1.04),at(.97,-.82,1.04),at(-.97,-.82,1.04)],'#70808b','#506270');
  }
  svg += line([row.x,row.y,0],centerPoint,blocked?'#bd2028':'#087ea4',2,'4 4');
  const [ex,ey] = px(eyePoint);
  svg += `<circle cx="${ex}" cy="${ey}" r="7" fill="#b85c1d" stroke="#fff" stroke-width="2"/>`;
  svg += label(eyePoint,'Глаза '+f(eye)+' см',10,18);
  const callout = (point,text,dx,dy) => {
    const p=px(point), x=Math.max(30,Math.min(760,p[0]+dx)), y=Math.max(50,Math.min(560,p[1]+dy));
    return `<path d="M ${p[0]},${p[1]} L ${x-7},${y-5}" stroke="#6f859a" stroke-width="1.2" fill="none"/><circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#087ea4"/><text x="${x}" y="${y}">${esc(text)}</text>`;
  };
  svg += callout(centerPoint,'Центр ТВ '+f(center)+' см',110,35);
  svg += callout([plan.A,0,mount],'Крепление '+f(mount)+' см',110,-55);
  svg += label(at(-1,1,0),'Ш '+f(plan.W)+' × В '+f(plan.H)+' см',-14,-18);
  svg += label([0,0,0],'Пол · 0 см',-15,20);
  svg += `<text x="26" y="612">До глаз: ${f(solution.distance3d)} см · наклон: ${f(tilt)}° · масштаб сетки: ${f(step)} см</text>`;
  $('room-scene').innerHTML = svg;
  $('room-scene').setAttribute('aria-label', row.title + '; центр телевизора ' + f(center) + ' см; глаза ' + f(eye) + ' см; ' + (blocked?'недоступно':'доступно по геометрии'));
}

document.addEventListener('tv-plan-updated', readPlan);
$('height-planner').querySelectorAll('input,select').forEach(element => element.addEventListener('input', () => {
  if(element.id === 'height-mode') {
    const offset = +$('mount-offset').value;
    if(previousMode === 'center') $('mount-height').value = (+$('center-height').value-offset).toFixed(1);
    else $('center-height').value = (+$('mount-height').value+offset).toFixed(1);
    previousMode = element.value;
  }
  update();
}));
$('apply-height').addEventListener('click', () => {
  if(!solution || $('apply-height').disabled) return;
  const field = $('height-mode').value === 'center' ? $('center-height') : $('mount-height');
  field.value = ($('height-mode').value === 'center' ? solution.target : solution.targetMount).toFixed(1);
  update();
});
$('aim-screen').addEventListener('click', () => {
  if(!solution || $('aim-screen').disabled) return;
  $('screen-tilt').value = solution.aimTilt.toFixed(1);
  update();
});
for(const [id,angle] of [['level-gaze',0],['reclined-gaze',10]]) $(id).addEventListener('click', () => { $('gaze-angle').value=angle; update(); });
$('use-philips').addEventListener('click', () => {
  $('diag').value = 55; $('precise').checked = true;
  $('tv-width').value = 122.5; $('tv-height').value = 74; $('tv-depth').value = 5.6;
  $('tv-depth').dispatchEvent(new Event('input',{bubbles:true}));
});
for(const id of ['camera-yaw','camera-elevation']) $(id).addEventListener('input',renderScene);
$('reset-camera').addEventListener('click', () => { $('camera-yaw').value=-45; $('camera-elevation').value=35.3; renderScene(); });
readPlan();
