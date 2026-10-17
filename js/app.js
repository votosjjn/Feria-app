(() => {
  const $ = (q, root = document) => root.querySelector(q);
  const $$ = (q, root = document) => [...root.querySelectorAll(q)];
  const loader = $('#loader');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Give the creator credit an occasional arcade style signal glitch.
  const footerCredit = $('.footer-credit');
  if (footerCredit && !reducedMotion) {
    const glitchCredit = () => {
      footerCredit.classList.add('is-glitch');
      setTimeout(() => footerCredit.classList.remove('is-glitch'), 1500);
      setTimeout(glitchCredit, 2400 + Math.random() * 4300);
    };
    setTimeout(glitchCredit, 2400 + Math.random() * 5000);
  }

  // Short boot sequence, then hand control to the existing welcome screen.
  const loadingFill = $('#loadingFill');
  const loadingNote = $('#loadingNote');
  const bootBar = $('.loading-track');
  const bootSteps = $$('.boot-checks [data-boot-step]');
  const bootSequence = [
    { at: 260, progress: 16, label: 'CHECKING SYSTEM...', step: 0 },
    { at: 850, progress: 38, label: 'LOADING PROJECTS...', step: 1 },
    { at: 1450, progress: 61, label: 'LOADING ARCADE...', step: 2 },
    { at: 2050, progress: 83, label: 'LOADING PHOTO SYSTEM...', step: 3 },
    { at: 2650, progress: 100, label: 'SYSTEM READY', step: 4 }
  ];
  function setBootStep({ progress, label, step }) {
    loadingFill.style.width = `${progress}%`;
    bootBar.setAttribute('aria-valuenow', String(progress));
    loadingNote.textContent = label;
    $('#loadingPercent').textContent = `${String(progress).padStart(2, '0')}%`;
    bootSteps.forEach((item, index) => item.classList.toggle('complete', index < step));
  }
  if (reducedMotion) {
    setBootStep(bootSequence.at(-1));
    loader.classList.add('done');
    const welcome = $('#welcomeScreen'); welcome.hidden = false; welcome.classList.add('visible');
  } else {
    bootSequence.forEach((entry, index) => setTimeout(() => {
      setBootStep(entry);
      if (index === bootSequence.length - 1) {
        loader.classList.add('done');
        const welcome = $('#welcomeScreen'); welcome.hidden = false;
        requestAnimationFrame(() => welcome.classList.add('visible'));
      }
    }, entry.at));
  }

  // Layered pixel particles: slow background drift, midground shapes, foreground sparkles.
  const particleCanvas = $('#ambientParticles');
  const particleContext = particleCanvas.getContext('2d');
  const ambient = { width: 0, height: 0, ratio: 1, items: [], bursts: [], scene: 'home', frame: 0 };
  const scenePalettes = {
    inicio: ['#35d9ff', '#25a5ff', '#ffd21f', '#ff8a32'],
    juego: ['#45ddff', '#737bff', '#b45dff', '#ffd21f'],
    proyectos: ['#39e6bd', '#35d9ff', '#8aff75', '#ffd21f'],
    fotos: ['#35d9ff', '#ff9b42', '#ff4cb8', '#ffd21f']
  };
  function setAmbientScene(id) {
    ambient.scene = id;
    document.body.dataset.scene = id;
    const palette = scenePalettes[id] || scenePalettes.inicio;
    ambient.items.forEach((dot, i) => { dot.hue = palette[i % palette.length]; });
  }
  function resizeAmbient() {
    ambient.ratio = Math.min(1.5, window.devicePixelRatio || 1);
    ambient.width = window.innerWidth; ambient.height = window.innerHeight;
    particleCanvas.width = Math.round(ambient.width * ambient.ratio);
    particleCanvas.height = Math.round(ambient.height * ambient.ratio);
    particleContext.setTransform(ambient.ratio, 0, 0, ambient.ratio, 0, 0);
    const weakDevice = (navigator.hardwareConcurrency || 8) <= 4 || matchMedia('(max-width: 700px)').matches;
    const count = Math.min(weakDevice ? 76 : 142, Math.max(weakDevice ? 38 : 58, Math.round(ambient.width * ambient.height / (weakDevice ? 18000 : 10500))));
    ambient.items = Array.from({ length: count }, (_, i) => ({
      x: Math.random() * ambient.width, y: Math.random() * ambient.height,
      size: [1, 1.5, 2, 3, 4][Math.floor(Math.random() * 5)],
      speed: .07 + Math.random() * (i % 5 === 0 ? .9 : .38), drift: (Math.random() - .5) * (i % 4 === 0 ? .55 : .16),
      phase: Math.random() * Math.PI * 2, depth: Math.random(),
      kind: Math.random(), hue: (scenePalettes[ambient.scene] || scenePalettes.inicio)[i % 4]
    }));
  }
  function drawAmbient(time) {
    if (document.hidden) { ambient.frame = requestAnimationFrame(drawAmbient); return; }
    const c = particleContext; c.clearRect(0, 0, ambient.width, ambient.height);
    for (const dot of ambient.items) {
      dot.y -= dot.speed; dot.x += dot.drift;
      if (dot.y < -5) { dot.y = ambient.height + 5; dot.x = Math.random() * ambient.width; }
      if (dot.x < -5) dot.x = ambient.width + 5; else if (dot.x > ambient.width + 5) dot.x = -5;
      const flicker = (Math.sin(time / (dot.depth > .8 ? 280 : 1100) + dot.phase) + 1) / 2;
      c.globalAlpha = (.2 + flicker * (dot.depth > .8 ? .7 : .42)) * (.55 + dot.depth * .45);
      c.fillStyle = dot.hue;
      const x = Math.round(dot.x), y = Math.round(dot.y), s = dot.size;
      if (dot.kind > .91) { c.fillRect(x - s * 1.5, y, s * 4, 1); c.fillRect(x, y - s * 1.5, 1, s * 4); }
      else { c.fillRect(x, y, s, s); if (dot.depth > .72 && flicker > .85) { c.globalAlpha *= .23; c.fillRect(x - s * 2, y - s * 2, s * 5, s * 5); } }
    }
    ambient.bursts = ambient.bursts.filter(b => time - b.at < 650);
    for (const burst of ambient.bursts) {
      const age = (time - burst.at) / 650;
      burst.bits.forEach(bit => {
        const distance = age * bit.distance;
        c.globalAlpha = (1 - age) * .95; c.fillStyle = bit.color;
        c.fillRect(burst.x + Math.cos(bit.angle) * distance, burst.y + Math.sin(bit.angle) * distance, bit.size, bit.size);
      });
    }
    c.globalAlpha = 1; ambient.frame = requestAnimationFrame(drawAmbient);
  }
  resizeAmbient(); addEventListener('resize', resizeAmbient, { passive: true });
  setAmbientScene((location.hash || '#inicio').slice(1));
  addEventListener('pointerdown', event => {
    if (reducedMotion || event.target.closest('button,a,input,video')) return;
    const palette = scenePalettes[ambient.scene] || scenePalettes.inicio;
    ambient.bursts.push({ x: event.clientX, y: event.clientY, at: performance.now(), bits: Array.from({ length: 12 }, (_, i) => ({ angle: i * Math.PI / 6, distance: 24 + Math.random() * 42, size: 2 + Math.random() * 3, color: palette[i % palette.length] })) });
  }, { passive: true });
  addEventListener('feria:burst', event => {
    if (reducedMotion) return;
    const { x, y, strength = 1 } = event.detail || {};
    const palette = scenePalettes[ambient.scene] || scenePalettes.inicio;
    const count = Math.round(22 * strength);
    ambient.bursts.push({ x, y, at: performance.now(), bits: Array.from({ length: count }, (_, i) => ({ angle: i * Math.PI * 2 / count, distance: 48 + Math.random() * 58, size: 3 + Math.random() * 4, color: palette[i % palette.length] })) });
  }, { passive: true });
  if (!reducedMotion) ambient.frame = requestAnimationFrame(drawAmbient);
  $('#welcomeStart').addEventListener('click', () => {
    const welcome = $('#welcomeScreen'); welcome.classList.add('launching');
    beep(760, .09);
    if (soundOn) start8BitMusic();
    setTimeout(() => { welcome.classList.remove('visible', 'launching'); welcome.hidden = true; }, reducedMotion ? 1 : 520);
  });

  const pages = $$('.page');
  let game = { running: false };
  let requestedGameMode = null;
  let previousPage = '';
  let curtainTimer;
  function route() {
    const id = (location.hash || '#inicio').slice(1);
    const target = pages.find(p => p.id === id) || $('#inicio');
    setAmbientScene(target.id);
    pages.forEach(p => p.classList.toggle('active', p === target));
    window.FeriaProjects?.refresh();
    $$('.desktop-nav a').forEach(a => a.classList.toggle('is-active', a.hash === `#${target.id}`));
    $('#app').dataset.transition = target.dataset.transition;
    if (previousPage && previousPage !== target.id && !reducedMotion) {
      const titles = { inicio: 'VOLVIENDO AL MENú', proyectos: 'CARGANDO PROYECTOS', juego: 'ENTRANDO A JUEGOS', fotos: 'ABRIENDO FOTOS' };
      $('#curtainTitle').textContent = titles[target.id] || 'PREPARANDO LA FERIA';
      const curtain = $('#sectionCurtain');
      const effect = target.id === 'juego' ? 'arcade' : target.id === 'proyectos' ? 'scan' : target.id === 'fotos' ? 'photo' : previousPage === 'juego' ? 'crt' : 'scan';
      curtain.dataset.effect = effect; curtain.classList.remove('shown'); void curtain.offsetWidth; curtain.classList.add('shown');
      clearTimeout(curtainTimer); curtainTimer = setTimeout(() => curtain.classList.remove('shown'), 680);
    }
    previousPage = target.id;
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (target.id !== 'juego' && game.running) pauseGame(true);
    if (target.id !== 'juego' && !$('#scoreEntry').hidden) finishScoreEntry(false);
    if (target.id === 'juego' && requestedGameMode) { selectGameMode(requestedGameMode); requestedGameMode = null; }
    if (target.id !== 'fotos') window.FeriaPhoto?.close();
  }
  addEventListener('hashchange', route);
  $$('[data-game-mode]').forEach(link => link.addEventListener('click', () => { requestedGameMode = link.dataset.gameMode; }));
  route();

  const heroArt = $('.hero-art');
  if (heroArt && !reducedMotion) {
    heroArt.addEventListener('pointermove', event => {
      const box = heroArt.getBoundingClientRect();
      heroArt.style.setProperty('--pointer-x', `${((event.clientX - box.left) / box.width - .5) * 2}`);
      heroArt.style.setProperty('--pointer-y', `${((event.clientY - box.top) / box.height - .5) * 2}`);
    }, { passive: true });
    heroArt.addEventListener('pointerleave', () => { heroArt.style.setProperty('--pointer-x', '0'); heroArt.style.setProperty('--pointer-y', '0'); }, { passive: true });
  }

  let soundOn = localStorage.getItem('feria-sound') !== 'off';
  const masterVolume = $('#masterVolume');
  const masterVolumeValue = $('#masterVolumeValue');
  const savedVolume = Number(localStorage.getItem('feria-volume') ?? 70);
  let soundLevel = Number.isFinite(savedVolume) ? Math.min(1, Math.max(0, savedVolume / 100)) : .7;
  masterVolume.value = String(Math.round(soundLevel * 100));
  let audioContext;
  function beep(freq = 540, duration = .055, volume = .035, type = 'sine') {
    if (!soundOn || soundLevel === 0) return;
    const AudioEngine = window.AudioContext || window.webkitAudioContext;
    if (!AudioEngine) return;
    audioContext ||= new AudioEngine();
    if (audioContext.state === 'suspended') audioContext.resume();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type; oscillator.frequency.value = freq;
    gain.gain.setValueAtTime(volume * soundLevel, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
  }
  const musicTracks=[
    'assets/audio/pixelate-pixel-dreams.mp3',
    'assets/audio/pixel-drift-pixel-dreams.mp3',
    'assets/audio/arcade-beat.mp3'
  ];
  let musicAudio=null, musicIndex=0, musicTimer=null, musicStarted=false;
  function playMusicTrack(){
    if(!soundOn||!musicStarted)return;
    musicAudio||=new Audio();
    musicAudio.preload='auto'; musicAudio.volume=.24 * soundLevel;
    musicAudio.onended=()=>{musicIndex=(musicIndex+1)%musicTracks.length;musicTimer=setTimeout(playMusicTrack,5000)};
    musicAudio.onerror=()=>{musicIndex=(musicIndex+1)%musicTracks.length;musicTimer=setTimeout(playMusicTrack,5000)};
    musicAudio.src=musicTracks[musicIndex]; musicAudio.currentTime=0;
    musicAudio.play().catch(()=>{musicStarted=false});
  }
  function start8BitMusic(){if(!soundOn||musicStarted)return;musicStarted=true;playMusicTrack()}
  function stop8BitMusic(){musicStarted=false;clearTimeout(musicTimer);musicTimer=null;if(musicAudio){musicAudio.pause();musicAudio.currentTime=0}}
  const soundToggle = $('#soundToggle');
  function updateSoundControl() {
    soundToggle.setAttribute('aria-pressed', String(soundOn));
    soundToggle.setAttribute('aria-label', soundOn ? 'Desactivar sonido' : 'Activar sonido');
    soundToggle.firstChild.textContent = `${soundOn ? '♫' : '♪'} `;
    soundToggle.querySelector('span').textContent = soundOn ? 'Sonido activo' : 'Sonido desactivado';
  }
  function updateVolumeControl() {
    masterVolumeValue.value = `${Math.round(soundLevel * 100)}%`;
    masterVolumeValue.textContent = masterVolumeValue.value;
    masterVolume.setAttribute('aria-valuetext', `${masterVolumeValue.value} volumen general`);
    if (musicAudio) musicAudio.volume = .24 * soundLevel;
  }
  updateSoundControl();
  updateVolumeControl();
  masterVolume.addEventListener('input', () => {
    soundLevel = Number(masterVolume.value) / 100;
    localStorage.setItem('feria-volume', masterVolume.value);
    updateVolumeControl();
  });
  soundToggle.addEventListener('click', e => {
    soundOn = !soundOn; e.currentTarget.setAttribute('aria-pressed', String(soundOn));
    localStorage.setItem('feria-sound', soundOn ? 'on' : 'off'); updateSoundControl();
    if (soundOn) { beep(700, .07, .025); start8BitMusic(); } else stop8BitMusic();
  });
  const soundPatterns = { hover: [660,.025,.009], click: [470,.045,.018], select: [720,.075,.022], back: [390,.07,.018], start: [520,.07,.022], confirm: [880,.12,.025], error: [180,.12,.02], photo: [1120,.07,.025], ready: [740,.12,.025] };
  function playCue(name) { const [freq,duration,volume] = soundPatterns[name] || soundPatterns.click; beep(freq,duration,volume, name==='error'?'triangle':'sine'); }
  document.addEventListener('click', event => {
    const control = event.target.closest('button, a'); if (!control || control === soundToggle) return;
    playCue(control.matches('.back-link,[href="#inicio"]') ? 'back' : control.matches('[data-mode],[data-scene],[data-project]') ? 'select' : control.id === 'gameStart' ? 'start' : 'click');
  }, { passive: true });
  let hoveredControl;
  document.addEventListener('pointerover', event => { const control=event.target.closest('button, a, .project-card'); if(control && control!==hoveredControl){hoveredControl=control;playCue('hover')} }, {passive:true});
  document.addEventListener('pointerout', event => { if(event.target.closest('button, a, .project-card')) hoveredControl=null; }, {passive:true});
  addEventListener('feria:sound', event => playCue(event.detail?.cue));
  // Small, color-matched click bursts make controls feel responsive without adding dependencies.
  document.addEventListener('pointerdown', e => {
    const control = e.target.closest('button, .button, .quick-dock a, .project-card');
    if (!control || control.disabled || control.closest('.dpad')) return;
    const bounds = control.getBoundingClientRect();
    const burst = document.createElement('i');
    burst.className = 'click-burst';
    burst.style.left = `${e.clientX - bounds.left}px`;
    burst.style.top = `${e.clientY - bounds.top}px`;
    control.append(burst);
    setTimeout(() => burst.remove(), 650);
  }, { passive: true });

  const fullscreenToggle = $('#fullscreenToggle');
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { showToast('La pantalla completa no está disponible en este navegador.'); }
  }
  fullscreenToggle.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', () => {
    const active = Boolean(document.fullscreenElement);
    fullscreenToggle.setAttribute('aria-label', active ? 'Salir de pantalla completa' : 'Activar pantalla completa');
    fullscreenToggle.querySelector('span').textContent = active ? 'SALIR DE PANTALLA COMPLETA' : 'PANTALLA COMPLETA';
  });

  const projects = {
    votacion: { title: 'Sistema de Votación Electrónico', eyebrow: 'PROYECTO 01 · SISTEMA DIGITAL', description: 'Una propuesta digital creada para apoyar la organización de una jornada de votación. Explora su presentación en la feria y conoce el proyecto de primera mano.', tags: ['Votación', 'Proyecto escolar'], visit: 'pending' },
    gusano: { title: 'Gusano & Manzana', eyebrow: 'PROYECTO 02 · JUEGO INTERACTIVO', description: 'Un reto arcade para recoger manzanas, sumar puntos y poner a prueba tus reflejos. Usa el teclado, los controles táctiles o desliza sobre el tablero.', tags: ['Juego', 'Arcade'], visit: '#juego' }
  };
  const modal = $('#projectModal');
  let selectedProject = null;
  function openProject(key) {
    selectedProject = projects[key];
    $('#modalTitle').textContent = selectedProject.title;
    $('#modalEyebrow').textContent = selectedProject.eyebrow;
    $('#modalDescription').textContent = selectedProject.description;
    $('#modalTags').innerHTML = selectedProject.tags.map(t => `<span>${t}</span>`).join('');
    const art = $('#modalArt'); art.className = `modal-art${key === 'gusano' ? ' worm-art' : ''}`;
    art.innerHTML = key === 'gusano' ? '<div class="worm-mascot" aria-hidden="true"><span></span><span></span><span></span><b>●</b></div>' : '<img class="voting-project-logo modal-voting-logo" src="assets/images/projects/logo-mi-voto.webp" alt="Logo del Sistema de Votación Mi Voto">';
    $('#modalVisit').textContent = key === 'gusano' ? 'Jugar ahora →' : 'Ficha del proyecto →';
    modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); document.body.classList.add('modal-open');
    $('.modal-close').focus();
  }
  $$('[data-project]').forEach(card => card.addEventListener('click', () => openProject(card.dataset.project)));
  const galleryProjects = {
    votacion: { number:'01', title:'Sistema de Votación Electrónico', category:'SISTEMA DIGITAL · FERIA 2026', description:'Una propuesta digital para organizar y vivir una jornada de votación.', glyph:'✓', ready:true },
    'proyecto-2': { number:'02', title:'Proyecto 02', category:'ESPACIO RESERVADO', description:'Pronto aquí conocerás una nueva idea creada para la feria.', glyph:'✳' },
    'proyecto-3': { number:'03', title:'Proyecto 03', category:'ESPACIO RESERVADO', description:'Pronto aquí conocerás una nueva idea creada para la feria.', glyph:'◇' },
    'proyecto-4': { number:'04', title:'Proyecto 04', category:'ESPACIO RESERVADO', description:'Pronto aquí conocerás una nueva idea creada para la feria.', glyph:'▦' },
    'proyecto-5': { number:'05', title:'Proyecto 05', category:'ESPACIO RESERVADO', description:'Pronto aquí conocerás una nueva idea creada para la feria.', glyph:'✦' },
    'proyecto-6': { number:'06', title:'Proyecto 06', category:'ESPACIO RESERVADO', description:'Pronto aquí conocerás una nueva idea creada para la feria.', glyph:'⌘' },
    'proyecto-7': { number:'07', title:'Proyecto 07', category:'ESPACIO RESERVADO', description:'Pronto aquí conocerás una nueva idea creada para la feria.', glyph:'◈' },
    'proyecto-8': { number:'08', title:'Proyecto 08', category:'ESPACIO RESERVADO', description:'Pronto aquí conocerás una nueva idea creada para la feria.', glyph:'✧' }
  };
  let gallerySelection='votacion';
  const galleryViewport=$('#projectGalleryViewport');
  const galleryCards=$$('[data-gallery-project]');
  function selectGalleryProject(key, centerCard=true) {
    const project=galleryProjects[key];if(!project)return;
    gallerySelection=key;
    galleryCards.forEach(card=>{const selected=card.dataset.galleryProject===key;card.classList.toggle('is-selected',selected);card.setAttribute('aria-pressed',String(selected))});
    $('#projectCurrentIndex').textContent=project.number;
    if(centerCard){const card=galleryCards.find(item=>item.dataset.galleryProject===key);if(card){const viewRect=galleryViewport.getBoundingClientRect(),cardRect=card.getBoundingClientRect(),left=galleryViewport.scrollLeft+cardRect.left-viewRect.left-(galleryViewport.clientWidth-card.clientWidth)/2;galleryViewport.scrollTo({left,behavior:'smooth'})}}
    $('#phoneProjectNumber').textContent=project.number;
    $('#phoneProjectTitle').textContent=project.title;
    $('#phoneProjectCategory').textContent=project.category;
    $('#phoneProjectDescription').textContent=project.description;
    $('#phoneProjectLogo').hidden=!project.ready;
    $('#phoneProjectGlyph').hidden=Boolean(project.ready);
    $('#phoneProjectGlyph').textContent=project.glyph;
    const action=$('#phoneProjectAction');action.disabled=!project.ready;action.innerHTML=project.ready?'VER FICHA <b>↗</b>':'FICHA EN PREPARACIÓN';
  }
  const galleryKeys=galleryCards.map(card=>card.dataset.galleryProject);
  galleryCards.forEach(card => card.addEventListener('click',()=>selectGalleryProject(card.dataset.galleryProject)));
  function stepGallery(direction){const index=galleryKeys.indexOf(gallerySelection);selectGalleryProject(galleryKeys[(index+direction+galleryKeys.length)%galleryKeys.length])}
  $('#projectPrevious').addEventListener('click',()=>stepGallery(-1));
  $('#projectNext').addEventListener('click',()=>stepGallery(1));
  galleryViewport.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'){event.preventDefault();stepGallery(-1)}else if(event.key==='ArrowRight'){event.preventDefault();stepGallery(1)}});
  let galleryScrollTimer=0;
  function settleGalleryScroll() {
    clearTimeout(galleryScrollTimer);
    galleryViewport.classList.remove('is-scrolling');
    const viewport=galleryViewport.getBoundingClientRect(),center=viewport.left+viewport.width/2;let nearest=null,distance=Infinity;
    galleryCards.forEach(card=>{const rect=card.getBoundingClientRect(),nextDistance=Math.abs(rect.left+rect.width/2-center);if(nextDistance<distance){distance=nextDistance;nearest=card}});
    if(nearest&&nearest.dataset.galleryProject!==gallerySelection)selectGalleryProject(nearest.dataset.galleryProject,false);
  }
  galleryViewport.addEventListener('scroll',()=>{
    galleryViewport.classList.add('is-scrolling');
    clearTimeout(galleryScrollTimer);
    galleryScrollTimer=setTimeout(settleGalleryScroll,140);
  },{passive:true});
  galleryViewport.addEventListener('scrollend',settleGalleryScroll,{passive:true});
  window.FeriaProjects={refresh:()=>requestAnimationFrame(()=>selectGalleryProject(gallerySelection,true))};
  if($('#proyectos').classList.contains('active'))window.FeriaProjects.refresh();
  $('#phoneProjectAction').addEventListener('click',()=>{if(gallerySelection==='votacion')openProject('votacion')});
  selectGalleryProject(gallerySelection);
  $$('[data-close]').forEach(el => el.addEventListener('click', closeModal));
  function closeModal() { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); document.body.classList.remove('modal-open'); }
  addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('open')) closeModal(); });
  $('#modalVisit').addEventListener('click', () => {
    if (selectedProject.visit === 'pending') { closeModal(); showToast('La ficha detallada de este proyecto se completará cuando estén disponibles sus materiales.'); return; }
    closeModal(); location.hash = selectedProject.visit;
  });

  const toast = $('#toast'); let toastTimer;
  function showToast(text) { toast.textContent = text; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 3000); }

  const leaderboardKey = mode => `feria-${mode}-leaderboard`;
  const leaderboardNames = { snake:'GUSANO & MANZANA', galaga:'GALAGA', tetris:'TETRIS', flight:'FLAPPY BIRD', bomber:'BOMBERMAN', maze:'PAC-MAN', tower:'DONKEY KONG' };
  const leaderboardSeedVersion = 'miguel-reset-2026-10-07';
  const defaultLeaderboards = {
    snake: [{ name:'MIGUEL', score:8900 }],
    galaga: [{ name:'MIGUEL', score:5600 }],
    tetris: [{ name:'MIGUEL', score:20500 }]
  };
  let pendingScore = null, gameCelebrationTimer = null;
  function seedLeaderboards() {
    if(localStorage.getItem('feria-leaderboard-seed')===leaderboardSeedVersion)return;
    Object.entries(defaultLeaderboards).forEach(([mode,rows])=>{
      localStorage.setItem(leaderboardKey(mode),JSON.stringify(rows));
      localStorage.setItem(`feria-${mode}-best`,String(rows[0].score));
    });
    localStorage.setItem('feria-leaderboard-seed',leaderboardSeedVersion);
  }
  seedLeaderboards();
  function getLeaderboard(mode) {
    try {
      const parsed=JSON.parse(localStorage.getItem(leaderboardKey(mode))||'[]');
      if(!Array.isArray(parsed))return [];
      return parsed.filter(row=>row&&typeof row.name==='string'&&Number.isFinite(Number(row.score))&&Number(row.score)>0)
        .map(row=>({name:row.name.trim().slice(0,10)||'PLAYER',score:Number(row.score)}))
        .sort((a,b)=>b.score-a.score).slice(0,5);
    } catch { return []; }
  }
  function isScoreContender(mode,score) { const rows=getLeaderboard(mode);return score>0&&(rows.length<5||score>=rows[rows.length-1].score); }
  function renderLeaderboard(mode) {
    const list=$('#leaderboardList');if(!list)return;list.replaceChildren();const rows=getLeaderboard(mode);
    if(!rows.length){const empty=document.createElement('li');empty.className='leaderboard-empty';empty.textContent='SIN PUNTAJES · SÉ EL PRIMERO';list.append(empty);return}
    rows.forEach((row,index)=>{const item=document.createElement('li');item.className=`leaderboard-row rank-${index+1}`;const rank=document.createElement('span');rank.className='leaderboard-rank';rank.textContent=String(index+1).padStart(2,'0');const name=document.createElement('b');name.className='leaderboard-name';name.textContent=row.name;name.dataset.text=row.name;const score=document.createElement('strong');score.className='leaderboard-score';score.textContent=row.score.toLocaleString('es-CO');item.append(rank,name,score);list.append(item)});
  }
  function saveLeaderboard(mode,name,score) {
    const rows=getLeaderboard(mode),old=rows.find(row=>row.name.toUpperCase()===name.toUpperCase());
    const nextScore=Math.max(Number(score)||0,old?.score||0);
    if(nextScore<=0)return {rank:0,qualified:false};
    const next=rows.filter(row=>row.name.toUpperCase()!==name.toUpperCase());next.push({name,score:nextScore});next.sort((a,b)=>b.score-a.score);
    const rank=next.findIndex(row=>row.name.toUpperCase()===name.toUpperCase())+1,qualified=rank>0&&rank<=5;
    localStorage.setItem(leaderboardKey(mode),JSON.stringify(next.slice(0,5)));
    return {rank,qualified};
  }
  function openScoreEntry({mode,score,contender,personalRecord}) {
    pendingScore={mode,score,contender,personalRecord};const dialog=$('#scoreEntry'),input=$('#playerName');
    $('#scoreEntryBadge').textContent=personalRecord?'NEW PERSONAL BEST':contender?'TOP 5 CONTENDER':'ARCADE RUN SAVED';
    $('#scoreEntryMessage').textContent=`${leaderboardNames[mode]}  ·  ${Number(score).toLocaleString('es-CO')} PTS`;
    input.value='';dialog.hidden=false;dialog.setAttribute('aria-hidden','false');dialog.classList.add('open');
    // Touch TVs may report a fine primary pointer; use the custom arcade keyboard.
    const hasTouchInput = navigator.maxTouchPoints > 0 || matchMedia('(pointer:coarse)').matches;
    if(!hasTouchInput)input.focus({preventScroll:true});
  }
  function finishScoreEntry(save=true) {
    const dialog=$('#scoreEntry');if(dialog.hidden)return;let result={rank:0,qualified:false};
    if(save&&pendingScore){const input=$('#playerName');const name=(input.value.trim().toUpperCase()||'PLAYER 01').replace(/[^A-Z0-9 _-]/g,'').slice(0,10)||'PLAYER 01';localStorage.setItem('feria-player-name',name);result=saveLeaderboard(pendingScore.mode,name,pendingScore.score);renderLeaderboard(pendingScore.mode);}
    dialog.classList.remove('open');dialog.hidden=true;dialog.setAttribute('aria-hidden','true');
    if(save&&pendingScore){
      const earnedRecord=pendingScore.personalRecord,earnedTopFive=result.qualified;
      if(earnedRecord||earnedTopFive){
        const overlay=$('#gameOverlay'),banner=$('#recordCelebration');
        overlay.classList.toggle('new-record',earnedRecord);overlay.classList.toggle('top-five-entry',!earnedRecord&&earnedTopFive);
        banner.classList.toggle('top-five',!earnedRecord&&earnedTopFive);banner.querySelector('span').textContent=earnedRecord?'★ NEW PERSONAL RECORD ★':'★ TOP 5 PLAYER ★';banner.querySelector('b').textContent=earnedRecord?'ARCADE RECORD':'SCORE SAVED';
        banner.hidden=false;banner.classList.remove('show');void banner.offsetWidth;banner.classList.add('show');
        $('#gameEyebrow').textContent=earnedRecord?'NEW PERSONAL BEST':'TOP 5 ENTRY SAVED';
        $('#gameMessage').textContent=earnedRecord?`${result.rank?`TOP PLAYER #${String(result.rank).padStart(2,'0')} · `:''}${Number(pendingScore.score).toLocaleString('es-CO')} PUNTOS · ¡RÉCORD PERSONAL!`:`${result.rank?`TOP PLAYER #${String(result.rank).padStart(2,'0')} · `:''}${Number(pendingScore.score).toLocaleString('es-CO')} PUNTOS · NUEVA ENTRADA`;
        playCue('confirm');window.dispatchEvent(new CustomEvent('feria:burst',{detail:{x:innerWidth/2,y:innerHeight/2,strength:earnedRecord?1.1:.7}}));clearTimeout(gameCelebrationTimer);
        gameCelebrationTimer=setTimeout(()=>{banner.classList.remove('show','top-five');banner.hidden=true;overlay.classList.remove('new-record','top-five-entry')},4200);
      }
      else if(Number(pendingScore.score)>0)showToast('Partida guardada. ¡Vuelve a intentarlo para entrar al Top 5!');
      else showToast('¡Partida terminada! Consigue puntos para entrar al Top 5.');
    }
    pendingScore=null;
  }
  const scoreKeyboard=$('#scoreKeyboard');
  function updatePlayerName(value){const input=$('#playerName');input.value=value.slice(0,10);input.dispatchEvent(new Event('input'))}
  function bindScoreButton(button,action){let usedPointer=false;button.addEventListener('pointerdown',event=>{event.preventDefault();event.stopPropagation();usedPointer=true;action();setTimeout(()=>{usedPointer=false},0)});button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();if(usedPointer)return;action()})}
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(letter=>{const key=document.createElement('button');key.type='button';key.className='score-key';key.textContent=letter;key.setAttribute('aria-label',letter);bindScoreButton(key,()=>{const input=$('#playerName');updatePlayerName(input.value+letter)});scoreKeyboard.append(key)});
  $('#playerName').addEventListener('input',event=>{event.currentTarget.value=event.currentTarget.value.toUpperCase().replace(/[^A-Z0-9 _-]/g,'').slice(0,10)});
  bindScoreButton($('#scoreSpace'),()=>{const input=$('#playerName');if(input.value.length<10)updatePlayerName(input.value+' ')});
  bindScoreButton($('#scoreDelete'),()=>{const input=$('#playerName');updatePlayerName(input.value.slice(0,-1))});
  bindScoreButton($('#scoreSubmit'),()=>finishScoreEntry(true));bindScoreButton($('#scoreSkip'),()=>finishScoreEntry(false));
  $('#playerName').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();finishScoreEntry(true)}if(event.key==='Escape')finishScoreEntry(false)});
  addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('#scoreEntry').hidden)finishScoreEntry(false)});

  // Secret creator discoveries: a letter sequence or seven quick taps on the existing credit.
  const creatorSequence = ['m','i','g','u','e','l']; let sequenceIndex=0, creatorClicks=[];
  function showCreatorSecret(room=false) {
    let secret=$('#creatorSecret');
    if(!secret){secret=document.createElement('div');secret.id='creatorSecret';secret.className='creator-secret';secret.setAttribute('role','dialog');secret.setAttribute('aria-modal','true');secret.innerHTML='<div class="creator-secret-panel"><button class="creator-secret-close" aria-label="Cerrar">×</button><span class="creator-pixel-avatar" aria-hidden="true">▟</span><p class="eyebrow">SECRET FOUND · BUILD MA-01</p><h2></h2><p class="creator-secret-name">Miguel Amaya</p><p class="creator-secret-detail">BUILDING DIGITAL EXPERIENCES</p><small>STATUS: LEGENDARY</small></div>';document.body.append(secret);secret.addEventListener('click',e=>{if(e.target===secret||e.target.closest('.creator-secret-close'))secret.classList.remove('open')});}
    secret.querySelector('h2').textContent=room?'CREATOR ROOM':'CREATOR MODE UNLOCKED';secret.classList.add('open');playCue('confirm');
    if(!room){document.body.classList.add('creator-glitch');setTimeout(()=>document.body.classList.remove('creator-glitch'),700);window.dispatchEvent(new CustomEvent('feria:burst',{detail:{x:innerWidth/2,y:innerHeight/2,strength:1.1}}));}
  }
  addEventListener('keydown',e=>{if(e.key==='Escape')$('#creatorSecret')?.classList.remove('open');if(e.ctrlKey||e.altKey||e.metaKey||e.target.matches('input,textarea,[contenteditable="true"]'))return;const key=e.key.toLowerCase();sequenceIndex=key===creatorSequence[sequenceIndex]?sequenceIndex+1:key==='m'?1:0;if(sequenceIndex===creatorSequence.length){sequenceIndex=0;showCreatorSecret(false)}});
  $('.footer-credit')?.addEventListener('click',()=>{const now=Date.now();creatorClicks=creatorClicks.filter(time=>now-time<2400);creatorClicks.push(now);if(creatorClicks.length>=7){creatorClicks=[];showCreatorSecret(true)}});
  $('.footer-credit')?.setAttribute('tabindex','0'); $('.footer-credit')?.setAttribute('aria-label','Crédito del creador');
  $('.footer-credit')?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}});
  setInterval(()=>{const hud=$('#hudBuild');if(hud)hud.textContent=Math.random()<.12?'MA // 01':'SYSTEM ONLINE'},9000);

  // Snake game: 20 × 20 grid, local best score, keyboard, swipe and large touch pad.
  const canvas = $('#gameCanvas');
  // Keep the backing store at the game's logical resolution for older TV GPUs.
  const pixelRatio = 1;
  const galagaCanvas = $('#galagaCanvas');
  const tetrisCanvas = $('#tetrisCanvas');
  [canvas, galagaCanvas, tetrisCanvas].forEach(board => { board.width = 480 * pixelRatio; board.height = 480 * pixelRatio; });
  const ctx = canvas.getContext('2d');
  game = { running: false, paused: false, mode: 'snake', difficulty: 'medium', snake: [], dir: {x: 1, y: 0}, next: {x: 1, y: 0}, apple: {x: 12, y: 10}, score: 0, timer: 0, particles: [] };
  const gctx=galagaCanvas.getContext('2d');
  const tctx=tetrisCanvas.getContext('2d');
  const arcadeExtras=window.FeriaArcadeExtras.create(canvas,{
    onScore:score=>{game.score=score;$('#score').textContent=String(score).padStart(2,'0')},
    onGameOver:message=>endGame(message),
    beep
  });
  ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0); gctx.setTransform(pixelRatio,0,0,pixelRatio,0,0); tctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);
  const galaga={playerX:240,move:0,bullets:[],enemyShots:[],aliens:[],effects:[],pickups:[],direction:1,step:0,fireAt:0,lives:3,level:1,weaponUntil:0,invulnerableUntil:0,stars:Array.from({length:64},(_,i)=>({x:(i*137+37)%480,y:(i*83+19)%480,r:i%7===0?1.6:.8,phase:i*.73}))};
  const tetrominoes=[{color:'#51d9ff',cells:[[0,1],[1,1],[2,1],[3,1]]},{color:'#ffe16b',cells:[[1,0],[2,0],[1,1],[2,1]]},{color:'#bd83ff',cells:[[1,0],[0,1],[1,1],[2,1]]},{color:'#77e69b',cells:[[1,0],[2,0],[0,1],[1,1]]},{color:'#ff789e',cells:[[0,0],[1,0],[1,1],[2,1]]},{color:'#ffad67',cells:[[0,0],[0,1],[1,1],[2,1]]},{color:'#6f91ff',cells:[[2,0],[0,1],[1,1],[2,1]]}];
  const tetr={board:[],piece:null,nextPiece:null,x:3,y:0,dropAt:0,lines:0};
  const snakeSpeeds = { easy: 190, medium: 150, hard: 112 };
  function getSnakeSpeed(){return Math.max(76,(snakeSpeeds[game.difficulty]||snakeSpeeds.medium)-Math.floor(game.score/50)*5)}
  const tetrisSpeed = 480;
  function getTetrisSpeed(){return Math.max(130,tetrisSpeed-Math.floor(tetr.lines/2)*32-Math.floor(game.score/1400)*12)}
  function refreshTetrisSpeed(){if(game.running&&game.mode==='tetris'){clearInterval(game.timer);game.timer=setInterval(tick,getTetrisSpeed())}}
  const cell = 24, grid = 20;
  const storedBest = Number(localStorage.getItem('feria-snake-best') || 0);
  $('#bestScore').textContent = String(storedBest).padStart(2, '0');
  function roundedRect(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); }
  function renderGame() {
    ctx.clearRect(0, 0, 480, 480);
    const backdrop=ctx.createLinearGradient(0,0,0,480);backdrop.addColorStop(0,'#102342');backdrop.addColorStop(1,'#071321');ctx.fillStyle=backdrop;ctx.fillRect(0,0,480,480);
    ctx.fillStyle='rgba(48,105,135,.09)';for(let y=0;y<grid;y++)for(let x=0;x<grid;x++)if((x+y)%2===0)ctx.fillRect(x*cell,y*cell,cell,cell);
    ctx.strokeStyle='rgba(115,198,221,.13)';ctx.lineWidth=1;
    for(let i=0;i<=grid;i++){ctx.beginPath();ctx.moveTo(i*cell,0);ctx.lineTo(i*cell,480);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*cell);ctx.lineTo(480,i*cell);ctx.stroke()}
    const ax=(game.apple.x+.5)*cell,ay=(game.apple.y+.5)*cell,pulse=Math.sin(performance.now()/120)*2;
    ctx.fillStyle='rgba(255,110,84,.18)';ctx.beginPath();ctx.arc(ax,ay,15+pulse,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#d84950';ctx.fillRect(ax-6,ay-5,12,13);ctx.fillRect(ax-8,ay-2,16,8);ctx.fillStyle='#ff8880';ctx.fillRect(ax-5,ay-4,4,5);
    ctx.fillStyle='#8be282';ctx.fillRect(ax,ay-9,3,5);ctx.fillRect(ax+3,ay-11,5,3);
    game.snake.forEach((p,i)=>{
      const x=p.x*cell+2,y=p.y*cell+2,tail=i===game.snake.length-1;
      ctx.fillStyle=i===0?'#b4f07a':`hsl(${132-i*1.3}, 55%, ${43-Math.min(i,18)*.45}%)`;
      const inset=tail?5:3;roundedRect(ctx,x+inset,y+inset,cell-inset*2,cell-inset*2,i===0?7:5);
      ctx.fillStyle=i===0?'#e4ffa4':'rgba(210,255,190,.38)';
      if(!tail){ctx.fillRect(x+5,y+5,4,3);ctx.fillRect(x+12,y+5,4,3)}
      if(i===0){
        const eye=game.dir.x<0?[x+5,x+5]:game.dir.x>0?[x+14,x+14]:game.dir.y<0?[x+6,x+14]:[x+6,x+14];
        const eyeY=game.dir.y<0?y+5:game.dir.y>0?y+14:y+7;
        ctx.fillStyle='#102333';ctx.fillRect(eye[0],eyeY,3,3);ctx.fillRect(eye[1],game.dir.x===0?eyeY:eyeY+6,3,3);
        ctx.fillStyle='#f5ffe0';ctx.fillRect(eye[0],eyeY,1,1);ctx.fillRect(eye[1],game.dir.x===0?eyeY:eyeY+6,1,1);
      }
    });
    game.particles=game.particles.filter(p=>p.life>0);game.particles.forEach(p=>{p.life--;p.x+=p.dx*.38;p.y+=p.dy*.38;ctx.globalAlpha=p.life/18;ctx.fillStyle=p.life%2?'#ffd46b':'#ff8c63';ctx.fillRect(p.x,p.y,3,3)});ctx.globalAlpha=1;
  }
  function renderTetris(){
    tctx.clearRect(0,0,480,480);const bg=tctx.createLinearGradient(0,0,0,480);bg.addColorStop(0,'#122744');bg.addColorStop(1,'#071321');tctx.fillStyle=bg;tctx.fillRect(0,0,480,480);
    const ox=120,cellSize=24;tctx.fillStyle='#07101deF';tctx.fillRect(ox-4,0,248,480);tctx.strokeStyle='#6bcce633';tctx.strokeRect(ox-4,0,248,480);
    for(let x=0;x<=10;x++){tctx.strokeStyle='rgba(123,166,193,.13)';tctx.beginPath();tctx.moveTo(ox+x*cellSize,0);tctx.lineTo(ox+x*cellSize,480);tctx.stroke()}
    for(let y=0;y<=20;y++){tctx.beginPath();tctx.moveTo(ox,y*cellSize);tctx.lineTo(ox+240,y*cellSize);tctx.stroke()}
    const draw=(x,y,color,alpha=1)=>{if(y<0)return;tctx.globalAlpha=alpha;tctx.fillStyle='#07101d';tctx.fillRect(ox+x*cellSize+1,y*cellSize+1,cellSize-2,cellSize-2);tctx.fillStyle=color;tctx.fillRect(ox+x*cellSize+2,y*cellSize+2,cellSize-4,cellSize-4);tctx.fillStyle='#ffffff66';tctx.fillRect(ox+x*cellSize+3,y*cellSize+3,cellSize-7,3);tctx.fillStyle='#02081466';tctx.fillRect(ox+x*cellSize+3,y*cellSize+cellSize-5,cellSize-6,2);tctx.globalAlpha=1};
    tetr.board.forEach((row,y)=>row.forEach((color,x)=>{if(color)draw(x,y,color)}));
    if(tetr.piece){
      let ghostY=tetr.y;while(!tetrisCollision(0,ghostY-tetr.y+1))ghostY++;
      tetr.piece.cells.forEach(([x,y])=>draw(tetr.x+x,ghostY+y,tetr.piece.color,.25));
      tetr.piece.cells.forEach(([x,y])=>draw(tetr.x+x,tetr.y+y,tetr.piece.color));
    }
    tctx.fillStyle='#7de3f3';tctx.font='bold 10px monospace';tctx.fillText('NEXT',15,36);
    tctx.fillStyle='#10223a';tctx.fillRect(12,44,92,72);tctx.strokeStyle='#4c7a98';tctx.strokeRect(12,44,92,72);
    if(tetr.nextPiece){const minX=Math.min(...tetr.nextPiece.cells.map(cell=>cell[0])),minY=Math.min(...tetr.nextPiece.cells.map(cell=>cell[1]));tetr.nextPiece.cells.forEach(([x,y])=>{tctx.fillStyle=tetr.nextPiece.color;tctx.fillRect(44+(x-minX)*12,63+(y-minY)*12,10,10);tctx.fillStyle='#ffffff66';tctx.fillRect(45+(x-minX)*12,64+(y-minY)*12,7,2)})}
    tctx.fillStyle='#d8e9f6';tctx.font='bold 10px monospace';tctx.fillText(`LINEAS`,16,151);tctx.fillStyle='#ffe28a';tctx.font='bold 18px monospace';tctx.fillText(String(tetr.lines).padStart(2,'0'),18,174);
    tctx.fillStyle='#d8e9f6';tctx.font='bold 10px monospace';tctx.fillText('NIVEL',16,214);tctx.fillStyle='#7de3f3';tctx.font='bold 18px monospace';tctx.fillText(String(Math.floor(tetr.lines/10)+1).padStart(2,'0'),18,237);
    tctx.fillStyle='#d8e9f6';tctx.font='bold 10px monospace';tctx.fillText('PUNTOS',365,151);tctx.fillStyle='#ffe28a';tctx.font='bold 14px monospace';tctx.fillText(String(game.score).padStart(5,'0'),351,176);
    tctx.fillStyle='#91a8c1';tctx.font='9px monospace';tctx.fillText('GHOST = ATERRIZAJE',14,441);tctx.fillText(`VEL ${Math.max(1,Math.floor((tetrisSpeed-getTetrisSpeed())/64)+1)}`,373,462);
  }
  function chooseTetromino(){const chosen=tetrominoes[Math.floor(Math.random()*tetrominoes.length)];return{color:chosen.color,cells:chosen.cells.map(c=>[...c])}}
  function newTetromino(){tetr.piece=tetr.nextPiece||chooseTetromino();tetr.nextPiece=chooseTetromino();tetr.x=3;tetr.y=0;if(tetrisCollision(0,0))endGame('LA TORRE LLEGÓ AL TECHO')}
  function tetrisCollision(dx,dy,cells=tetr.piece.cells){return cells.some(([x,y])=>{const px=tetr.x+x+dx,py=tetr.y+y+dy;return px<0||px>=10||py>=20||(py>=0&&tetr.board[py][px])})}
  function rotateTetromino(){if(!game.running||game.mode!=='tetris'||!tetr.piece)return;const rotated=tetr.piece.cells.map(([x,y])=>[2-y,x]);for(const kick of [0,-1,1,-2,2])if(!tetrisCollision(kick,0,rotated)){tetr.x+=kick;tetr.piece.cells=rotated;break}renderTetris()}
  function lockTetromino(){if(!tetr.piece)return;for(const [x,y] of tetr.piece.cells){const py=tetr.y+y;if(py<0){endGame('LA TORRE LLEGÓ AL TECHO');return}tetr.board[py][tetr.x+x]=tetr.piece.color}const before=tetr.board.length;tetr.board=tetr.board.filter(row=>row.some(cell=>!cell));const removed=20-tetr.board.length;if(removed){tetr.lines+=removed;game.score+=[0,100,300,500,800][removed]||800;$('#score').textContent=String(game.score).padStart(2,'0');beep(removed>1?980:760,.1,.025);refreshTetrisSpeed()}while(tetr.board.length<before)tetr.board.unshift(Array(10).fill(null));newTetromino();renderTetris()}
  function tickTetris(){if(!tetrisCollision(0,1))tetr.y++;else lockTetromino();renderTetris()}
  function placeApple(){const empty=[];for(let y=0;y<grid;y++)for(let x=0;x<grid;x++)if(!game.snake.some(s=>s.x===x&&s.y===y))empty.push({x,y});if(empty.length)game.apple=empty[Math.floor(Math.random()*empty.length)]}
  function seedAliens(){galaga.aliens=[];const rows=Math.min(5,3+Math.floor((galaga.level-1)/2)),cols=Math.min(9,7+Math.floor((galaga.level-1)/3)),gapX=cols===9?44:50,startX=(480-(cols-1)*gapX)/2;for(let row=0;row<rows;row++)for(let col=0;col<cols;col++)galaga.aliens.push({x:startX+col*gapX,y:72+row*34,row,col,alive:true})}
  function renderGalaga(){
    gctx.clearRect(0,0,480,480);const sky=gctx.createLinearGradient(0,0,0,480);sky.addColorStop(0,'#080f27');sky.addColorStop(.7,'#111e39');sky.addColorStop(1,'#152c43');gctx.fillStyle=sky;gctx.fillRect(0,0,480,480);
    for(let i=0;i<12;i++){gctx.fillStyle=i%2?'#283956':'#1d314b';gctx.fillRect(i*48,85,1,340)}
    for(const s of galaga.stars){gctx.globalAlpha=.24+.5*(.5+.5*Math.sin(performance.now()/850+s.phase));gctx.fillStyle=s.phase%2?'#88e9ff':'#ffe18c';gctx.fillRect(s.x,s.y,s.r,s.r)}gctx.globalAlpha=1;
    gctx.fillStyle='#67e5ff25';gctx.fillRect(16,423,448,2);gctx.fillStyle='#071425';gctx.fillRect(0,455,480,25);gctx.fillStyle='#2c536e';gctx.fillRect(0,455,480,3);
    galaga.effects=galaga.effects.filter(p=>p.life>0);for(const p of galaga.effects){p.x+=p.dx;p.y+=p.dy;p.life--;gctx.globalAlpha=p.life/20;gctx.fillStyle=p.color;gctx.fillRect(p.x,p.y,3,3)}gctx.globalAlpha=1;
    galaga.aliens.filter(a=>a.alive).forEach(a=>{const x=Math.round(a.x),y=Math.round(a.y),color=a.row===0?'#ff7892':a.row%2?'#ba76ff':'#52e2cf',flap=Math.floor(galaga.step/10)%2;gctx.fillStyle='#07101f';gctx.fillRect(x-13,y-5,26,15);gctx.fillStyle=color;gctx.fillRect(x-8,y-7,16,13);gctx.fillRect(x-12,y-3,24,9);gctx.fillRect(x-15,y-8-flap,5,6);gctx.fillRect(x+10,y-8-flap,5,6);gctx.fillRect(x-9,y+6,4,4+flap);gctx.fillRect(x+5,y+6,4,4+flap);gctx.fillStyle='#f8fbff';gctx.fillRect(x-6,y-2,4,4);gctx.fillRect(x+3,y-2,4,4);gctx.fillStyle='#172342';gctx.fillRect(x-5,y-1,2,3);gctx.fillRect(x+4,y-1,2,3)});
    galaga.pickups.forEach((item,index)=>{const pulse=Math.sin(performance.now()/90+index)*3;gctx.fillStyle='#fff0a6';gctx.fillRect(item.x-8,item.y-8+pulse,16,16);gctx.fillStyle='#305277';gctx.fillRect(item.x-5,item.y-5+pulse,10,10);gctx.fillStyle='#fff';gctx.fillRect(item.x-2,item.y-3+pulse,4,7)});
    if(performance.now()>galaga.invulnerableUntil||Math.floor(performance.now()/90)%2===0){const x=Math.round(galaga.playerX);gctx.fillStyle='#173451';gctx.fillRect(x-16,445,32,21);gctx.fillStyle='#4fd6ec';gctx.fillRect(x-12,439,24,20);gctx.fillRect(x-7,431,14,13);gctx.fillRect(x-19,454,7,10);gctx.fillRect(x+12,454,7,10);gctx.fillStyle='#c9fbff';gctx.fillRect(x-3,434,6,10);gctx.fillStyle='#ffda79';gctx.fillRect(x-2,459,4,10);if(galaga.weaponUntil>performance.now()){gctx.fillStyle='#d8a7ff';gctx.fillRect(x-15,442,4,6);gctx.fillRect(x+11,442,4,6)}}
    for(const b of galaga.bullets){gctx.fillStyle=b.color||'#fff3a3';gctx.fillRect(b.x-2,b.y-7,4,13);gctx.fillStyle='#fff';gctx.fillRect(b.x-1,b.y-5,2,7)}
    for(const b of galaga.enemyShots){gctx.fillStyle='#ff6c9a';gctx.fillRect(b.x-3,b.y,6,10);gctx.fillStyle='#ffd3db';gctx.fillRect(b.x-1,b.y+2,2,5)}
    gctx.fillStyle='#e9f5ff';gctx.font='bold 12px monospace';gctx.fillText(`NIVEL ${galaga.level} · VIDAS ${galaga.lives}`,15,24);gctx.fillText(`INVASORES ${galaga.aliens.filter(a=>a.alive).length}`,348,24);
    gctx.globalAlpha=1;
  }
  function fireGalaga(){if(!game.running||game.mode!=='galaga'||performance.now()<galaga.fireAt)return;const powered=performance.now()<galaga.weaponUntil;galaga.bullets.push({x:galaga.playerX,y:444,color:powered?'#d8a7ff':'#fff3a3'});if(powered){galaga.bullets.push({x:galaga.playerX-12,y:444,color:'#d8a7ff'},{x:galaga.playerX+12,y:444,color:'#d8a7ff'})}galaga.fireAt=performance.now()+(powered?230:260);beep(600,.025)}
  function gameTickInterval(){return game.mode==='galaga'||window.FeriaArcadeExtras.modes.has(game.mode)?32:game.mode==='tetris'?getTetrisSpeed():getSnakeSpeed()}
  function startGame(){
    clearInterval(game.timer);clearTimeout(gameCelebrationTimer);$('#recordCelebration').hidden=true;$('#recordCelebration').classList.remove('show','top-five');
    $('#arcadeCountdown').hidden=true;$('#snakeDifficulty').hidden=true;$('#flightDifficulty').hidden=true;$('#gameStart').hidden=false;
    document.body.classList.add('arcade-playing');$('#gameOverlay').classList.remove('game-over','new-record','top-five-entry');
    game.score=0;$('#score').textContent='00';game.running=true;game.paused=false;$('#gamePause').hidden=false;$('#gameOverlay').classList.add('hidden');
    if(window.FeriaArcadeExtras.modes.has(game.mode)){arcadeExtras.start(game.mode);game.timer=setInterval(tick,gameTickInterval());return}
    if(game.mode==='galaga'){
      galaga.playerX=240;galaga.move=0;galaga.bullets=[];galaga.enemyShots=[];galaga.effects=[];galaga.pickups=[];galaga.weaponUntil=0;galaga.direction=1;galaga.step=0;galaga.lives=3;galaga.level=1;galaga.invulnerableUntil=0;seedAliens();game.timer=setInterval(tick,gameTickInterval());renderGalaga();
    }else if(game.mode==='tetris'){
      tetr.board=Array.from({length:20},()=>Array(10).fill(null));tetr.lines=0;tetr.nextPiece=null;newTetromino();game.timer=setInterval(tick,gameTickInterval());renderTetris();
    }else{
      game.snake=[{x:7,y:10},{x:6,y:10},{x:5,y:10}];game.dir={x:1,y:0};game.next={x:1,y:0};placeApple();game.timer=setInterval(tick,gameTickInterval());renderGame();
    }
  }
  function pauseGame(showOverlay=false){
    if(!game.running)return;
    game.running=false;document.body.classList.remove('arcade-playing');game.paused=showOverlay;$('#gamePause').hidden=true;
    galaga.move=0;clearInterval(game.timer);clearInterval(fireTimer);clearInterval(canvasFireTimer);releaseArcadeInputs();
    if(showOverlay){
      $('#gameEyebrow').textContent='PARTIDA EN PAUSA';$('#gameTitle').textContent='Seguimos cuando quieras';
      $('#gameMessage').textContent=`Llevas ${game.score} puntos. Tu partida espera aquí.`;
      $('#gameStart').innerHTML='Continuar jugando <span>→</span>';$('#gameOverlay').classList.remove('hidden','game-over','new-record');$('#recordCelebration').hidden=true;
    }
  }
  function endGame(message=''){
    pauseGame();const mode=game.mode,storageKey=`feria-${mode}-best`,best=Number(localStorage.getItem(storageKey)||0),personalRecord=game.score>best&&game.score>0;
    if(personalRecord){localStorage.setItem(storageKey,String(game.score));$('#bestScore').textContent=String(game.score).padStart(2,'0')}
    const contender=isScoreContender(mode,game.score);
    $('#gameEyebrow').textContent=personalRecord?'NEW PERSONAL BEST':contender?'TOP 5 CONTENDER':'ARCADE RUN COMPLETE';
    $('#gameTitle').textContent=message.startsWith('¡')?'¡MISIÓN CUMPLIDA!':'GAME OVER';
    $('#gameMessage').textContent=`${message||'PARTIDA FINALIZADA'}  ·  SCORE ${Number(game.score).toLocaleString('es-CO')}`;
    $('#gameStart').innerHTML='JUGAR DE NUEVO <span>↻</span>';$('#gameOverlay').dataset.gameMode=mode;
    $('#gameOverlay').classList.remove('hidden','new-record','top-five-entry');$('#gameOverlay').classList.add('game-over');
    $('#recordCelebration').hidden=true;$('#recordCelebration').classList.remove('show','top-five');beep(220,.18);
    openScoreEntry({mode,score:game.score,contender,personalRecord});
  }
  function tickGalaga(){
    galaga.step++;const boost=Math.max(0,galaga.level-1),alienSpeed=1+boost*.22,enemyShotSpeed=4+boost*.35,shootEvery=Math.max(24,58-boost*4),maxVolley=Math.min(3,1+Math.floor(boost/4));
    galaga.playerX=Math.max(22,Math.min(458,galaga.playerX+galaga.move*5));
    if(galaga.step%2===0){const living=galaga.aliens.filter(a=>a.alive);if(living.some(a=>a.x>450)||living.some(a=>a.x<30)){galaga.direction*=-1;living.forEach(a=>a.y+=12+Math.min(12,boost*2))}living.forEach(a=>a.x+=galaga.direction*alienSpeed)}
    if(galaga.step%shootEvery===0){const shooters=galaga.aliens.filter(a=>a.alive);for(let i=0;i<maxVolley&&shooters.length;i++){const a=shooters[Math.floor(Math.random()*shooters.length)];galaga.enemyShots.push({x:a.x,y:a.y+12})}}
    galaga.bullets.forEach(b=>b.y-=10);galaga.enemyShots.forEach(b=>b.y+=enemyShotSpeed);galaga.pickups.forEach(item=>item.y+=1.7);
    galaga.bullets=galaga.bullets.filter(b=>b.y>0);galaga.enemyShots=galaga.enemyShots.filter(b=>b.y<480);galaga.pickups=galaga.pickups.filter(item=>item.y<480);
    for(const bullet of galaga.bullets){const hit=galaga.aliens.find(a=>a.alive&&Math.abs(a.x-bullet.x)<17&&bullet.y-10<=a.y+12&&bullet.y+5>=a.y-12);if(hit){hit.alive=false;bullet.y=-20;game.score+=10;$('#score').textContent=String(game.score).padStart(2,'0');for(let i=0;i<9;i++)galaga.effects.push({x:hit.x,y:hit.y,dx:Math.random()*5-2.5,dy:Math.random()*5-2.5,life:20,color:hit.row%2?'#e2a3ff':'#84fff1'});if(Math.random()<.12)galaga.pickups.push({x:hit.x,y:hit.y});beep(830,.055)}}
    const collected=galaga.pickups.findIndex(item=>Math.abs(item.x-galaga.playerX)<20&&Math.abs(item.y-450)<24);if(collected>=0){galaga.pickups.splice(collected,1);galaga.weaponUntil=performance.now()+9000;game.score+=50;$('#score').textContent=String(game.score).padStart(2,'0');beep(1020,.11)}
    if(performance.now()>galaga.invulnerableUntil&&galaga.enemyShots.some(b=>Math.abs(b.x-galaga.playerX)<17&&b.y>425&&b.y<470)){galaga.lives--;galaga.invulnerableUntil=performance.now()+1200;galaga.enemyShots=galaga.enemyShots.filter(b=>!(Math.abs(b.x-galaga.playerX)<17&&b.y>425&&b.y<470));beep(190,.12);if(galaga.lives<=0){renderGalaga();endGame('LA NAVE SE QUEDÓ SIN ESCUDOS');return}}
    if(galaga.aliens.some(a=>a.alive&&a.y>420)){renderGalaga();endGame('LA FLOTA INVASORA ALCANZÓ LA BASE');return}
    if(!galaga.aliens.some(a=>a.alive)){galaga.level++;galaga.enemyShots=[];seedAliens();beep(980,.12)}
    renderGalaga()
  }
  function tick(){
    if(window.FeriaArcadeExtras.modes.has(game.mode)){arcadeExtras.tick(game.mode);return}
    if(game.mode==='galaga'){tickGalaga();return}
    if(game.mode==='tetris'){tickTetris();return}
    game.dir=game.next;const h={x:game.snake[0].x+game.dir.x,y:game.snake[0].y+game.dir.y};
    h.x=(h.x+grid)%grid;h.y=(h.y+grid)%grid;
    if(game.snake.some((s,i)=>i<game.snake.length-1&&s.x===h.x&&s.y===h.y)){endGame('EL GUSANO CHOCÓ');return}
    game.snake.unshift(h);
    if(h.x===game.apple.x&&h.y===game.apple.y){
      game.score+=10;$('#score').textContent=String(game.score).padStart(2,'0');
      game.particles=Array.from({length:13},()=>({x:(h.x+.5)*cell,y:(h.y+.5)*cell,life:18,dx:Math.random()*12-6,dy:Math.random()*12-6}));
      game.particles.forEach(p=>{p.x+=p.dx;p.y+=p.dy});placeApple();beep(850,.09);
      if(game.score%50===0&&game.mode==='snake'){clearInterval(game.timer);game.timer=setInterval(tick,getSnakeSpeed())}
    }else game.snake.pop();
    renderGame();
  }
  function turn(d){
    if(!game.running){showToast('Elige un juego y pulsa empezar para jugar.');return}
    if(window.FeriaArcadeExtras.modes.has(game.mode)){arcadeExtras.direction(game.mode,d);return}
    if(game.mode==='galaga'){if(d.x)galaga.move=d.x;return}
    if(game.mode==='tetris'){if(d.x&&!tetrisCollision(d.x,0))tetr.x+=d.x;if(d.y>0)tickTetris();if(d.y<0)rotateTetromino();renderTetris();return}
    if(d.x===-game.dir.x&&d.y===-game.dir.y)return;
    game.next=d;
  }
  let gameCueTimers=[];
  function cancelGameCountdown(){gameCueTimers.forEach(clearTimeout);gameCueTimers=[];const cue=$('#arcadeCountdown'),overlay=$('#gameOverlay');if(cue){cue.hidden=true;cue.classList.remove('is-visible')}if(overlay)overlay.classList.remove('countdown-active');const button=$('#gameStart');if(button)button.disabled=false}
  addEventListener('hashchange',()=>{if(location.hash!=='#juego')cancelGameCountdown()});
  function beginGameCountdown(){
    const cue=$('#arcadeCountdown'),button=$('#gameStart'),beats=['3','2','1','GO!'];let index=0;
    gameCueTimers.forEach(clearTimeout);gameCueTimers=[];button.disabled=true;$('#gameOverlay').classList.remove('game-over','new-record');$('#gameOverlay').classList.add('countdown-active');$('#recordCelebration').hidden=true;cue.hidden=false;
    const showBeat=()=>{
      if(index>=beats.length){cue.classList.remove('is-visible');cue.hidden=true;button.disabled=false;$('#gameOverlay').classList.remove('countdown-active');gameCueTimers=[];startGame();return}
      const go=index===beats.length-1;cue.querySelector('b').textContent=beats[index++];cue.querySelector('small').textContent=go?'GO!':'GET READY';cue.classList.remove('is-visible');void cue.offsetWidth;cue.classList.add('is-visible');playCue(go?'confirm':'ready');
      if(go)window.dispatchEvent(new CustomEvent('feria:burst',{detail:{x:innerWidth/2,y:innerHeight/2,strength:.65}}));
      gameCueTimers=[setTimeout(showBeat,go?500:650)];
    };
    showBeat();
  }
  function showSnakeDifficulty(){const chooser=$('#snakeDifficulty');chooser.hidden=false;$('#gameStart').hidden=true;$('#gameEyebrow').textContent='DIFICULTAD DEL GUSANO';$('#gameTitle').textContent='Elige tu ritmo';$('#gameMessage').textContent='Puedes cambiar la dificultad antes de cada partida.'}
  function showFlightDifficulty(){const chooser=$('#flightDifficulty');chooser.hidden=false;$('#gameStart').hidden=true;$('#gameEyebrow').textContent='DIFICULTAD DE VUELO';$('#gameTitle').textContent='Elige tu desafío';$('#gameMessage').textContent='Todos los modos se vuelven más rápidos con cada nivel.'}
  $('#snakeDifficulty').addEventListener('click',e=>{const option=e.target.closest('[data-difficulty]');if(!option)return;game.difficulty=option.dataset.difficulty;$('#snakeDifficulty').querySelectorAll('[data-difficulty]').forEach(button=>button.setAttribute('aria-pressed',String(button===option)));$('#gameStart').hidden=false;beginGameCountdown()});
  $('#flightDifficulty').addEventListener('click',e=>{const option=e.target.closest('[data-flight-difficulty]');if(!option)return;const difficulty=option.dataset.flightDifficulty;arcadeExtras.setFlightDifficulty(difficulty);$('#flightDifficulty').querySelectorAll('[data-flight-difficulty]').forEach(button=>button.setAttribute('aria-pressed',String(button===option)));$('#gameStart').hidden=false;beginGameCountdown()});
  $('#gameStart').addEventListener('click',()=>{if(game.paused){game.paused=false;game.running=true;document.body.classList.add('arcade-playing');$('#gamePause').hidden=false;$('#gameOverlay').classList.add('hidden');game.timer=setInterval(tick,gameTickInterval());return}if(game.mode==='snake'){showSnakeDifficulty();return}if(game.mode==='flight'){showFlightDifficulty();return}beginGameCountdown()});
  $('#gamePause').addEventListener('click', () => { if (game.running) pauseGame(true); });
  $$('.dpad button').forEach(b=>{const dirs={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture?.(e.pointerId);turn(dirs[b.dataset.dir])});b.addEventListener('pointerup',()=>{if(game.mode==='galaga')galaga.move=0;else if(window.FeriaArcadeExtras.modes.has(game.mode))arcadeExtras.direction(game.mode,{x:0,y:0})});b.addEventListener('pointercancel',()=>{if(game.mode==='galaga')galaga.move=0;else if(window.FeriaArcadeExtras.modes.has(game.mode))arcadeExtras.direction(game.mode,{x:0,y:0})})});
  const fireButton=$('#fireButton');let fireTimer;fireButton.addEventListener('pointerdown',e=>{
    if(!game.running)return;
    e.preventDefault();fireButton.setPointerCapture?.(e.pointerId);
    if(game.mode==='galaga'){fireGalaga();clearInterval(fireTimer);fireTimer=setInterval(fireGalaga,190)}
    else if(window.FeriaArcadeExtras.modes.has(game.mode))arcadeExtras.action(game.mode);
  });['pointerup','pointercancel','lostpointercapture'].forEach(type=>fireButton.addEventListener(type,()=>clearInterval(fireTimer)));
  fireButton.addEventListener('click',event=>{
    if(event.detail!==0||!game.running)return;
    if(game.mode==='galaga')fireGalaga();
    else if(window.FeriaArcadeExtras.modes.has(game.mode))arcadeExtras.action(game.mode);
  });
  $('#jumpButton').addEventListener('click',()=>{if(game.running)arcadeExtras.jump(game.mode)});
  let extraCanvasTouch=null;
  canvas.addEventListener('pointerdown',event=>{
    if(!game.running||!window.FeriaArcadeExtras.modes.has(game.mode))return;
    event.preventDefault();
    extraCanvasTouch={id:event.pointerId,x:event.clientX,y:event.clientY,mode:game.mode};
    canvas.setPointerCapture?.(event.pointerId);
    if(game.mode!=='maze')arcadeExtras.pointerDown(game.mode,event.offsetX*480/canvas.clientWidth,event.offsetY*480/canvas.clientHeight);
  });
  canvas.addEventListener('pointerup',event=>{
    if(!extraCanvasTouch||event.pointerId!==extraCanvasTouch.id)return;
    const {x,y,mode}=extraCanvasTouch;extraCanvasTouch=null;
    if(mode!=='maze'||!game.running||game.mode!==mode)return;
    const dx=event.clientX-x,dy=event.clientY-y;
    if(Math.max(Math.abs(dx),Math.abs(dy))>=16)turn(Math.abs(dx)>Math.abs(dy)?{x:Math.sign(dx),y:0}:{x:0,y:Math.sign(dy)});
    else arcadeExtras.pointerDown(mode,event.offsetX*480/canvas.clientWidth,event.offsetY*480/canvas.clientHeight);
  });
  canvas.addEventListener('pointercancel',()=>{extraCanvasTouch=null});
  const heldGalagaKeys = new Set(); let keyboardFireTimer = null;
  function refreshGalagaKeyboardMove() { galaga.move = heldGalagaKeys.has('left') ? -1 : heldGalagaKeys.has('right') ? 1 : 0; }
  addEventListener('keydown', e => {
    if (location.hash !== '#juego' || !game.running) return;
    // Lock browser/page shortcuts while a round is active; game controls below remain available.
    e.preventDefault();
    if(window.FeriaArcadeExtras.modes.has(game.mode)){
      if(arcadeExtras.keyDown(game.mode,e)){e.stopImmediatePropagation();return}
      const dirs={arrowup:{x:0,y:-1},w:{x:0,y:-1},arrowdown:{x:0,y:1},s:{x:0,y:1},arrowleft:{x:-1,y:0},a:{x:-1,y:0},arrowright:{x:1,y:0},d:{x:1,y:0}};
      const direction=dirs[e.key.toLowerCase()];
      if(direction)turn(direction);
      e.stopImmediatePropagation();return;
    }
    if (game.mode === 'galaga') {
      const key = e.key.toLowerCase();
      if (key === 'arrowleft' || key === 'a') { e.preventDefault(); heldGalagaKeys.add('left'); refreshGalagaKeyboardMove(); }
      if (key === 'arrowright' || key === 'd') { e.preventDefault(); heldGalagaKeys.add('right'); refreshGalagaKeyboardMove(); }
      if (e.code === 'Space') { e.preventDefault(); fireGalaga(); if (!keyboardFireTimer) keyboardFireTimer = setInterval(fireGalaga, 190); }
      e.stopImmediatePropagation(); return;
    }
    if (game.mode === 'tetris') {
      if (e.key === 'ArrowLeft' && !tetrisCollision(-1,0)) { e.preventDefault(); tetr.x--; renderTetris(); }
      if (e.key === 'ArrowRight' && !tetrisCollision(1,0)) { e.preventDefault(); tetr.x++; renderTetris(); }
      if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') { e.preventDefault(); rotateTetromino(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); tickTetris(); }
      if (e.code === 'Space') { e.preventDefault(); while(!tetrisCollision(0,1))tetr.y++;lockTetromino(); }
      e.stopImmediatePropagation(); return;
    }
    const dirs={ArrowUp:{x:0,y:-1},w:{x:0,y:-1},ArrowDown:{x:0,y:1},s:{x:0,y:1},ArrowLeft:{x:-1,y:0},a:{x:-1,y:0},ArrowRight:{x:1,y:0},d:{x:1,y:0}};
    if (dirs[e.key]) turn(dirs[e.key]);
    e.stopImmediatePropagation();
  }, true);
  addEventListener('keyup', e => {
    const key = e.key.toLowerCase();
    if(window.FeriaArcadeExtras.modes.has(game.mode)&&['arrowleft','arrowright','arrowup','arrowdown','a','d','w','s'].includes(key)){
      arcadeExtras.direction(game.mode,{x:0,y:0});
    }
    if (key === 'arrowleft' || key === 'a') heldGalagaKeys.delete('left');
    if (key === 'arrowright' || key === 'd') heldGalagaKeys.delete('right');
    refreshGalagaKeyboardMove();
    if (e.code === 'Space' && keyboardFireTimer) { clearInterval(keyboardFireTimer); keyboardFireTimer = null; }
  });
  function releaseArcadeInputs() {
    heldGalagaKeys.clear(); refreshGalagaKeyboardMove(); clearInterval(keyboardFireTimer); keyboardFireTimer = null;
    if(window.FeriaArcadeExtras.modes.has(game.mode))arcadeExtras.direction(game.mode,{x:0,y:0});
  }
  ['dblclick','contextmenu','selectstart','dragstart'].forEach(type => document.addEventListener(type, e => {
    if (!game.running) return;
    e.preventDefault(); e.stopPropagation();
  }, true));
  addEventListener('blur', releaseArcadeInputs);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { releaseArcadeInputs(); if (game.running) pauseGame(true); } });
  const gameModeNames={snake:'GUSANO & MANZANA',galaga:'GALAGA',tetris:'TETRIS',flight:'FLAPPY BIRD',bomber:'BOMBERMAN',maze:'PAC-MAN',tower:'DONKEY KONG'};
  const gameHints={snake:'Flechas/WASD o desliza · acelera con abajo · cambia ritmo antes de iniciar',galaga:'Mueve y dispara · barra espaciadora o botón FIRE · esquiva proyectiles',tetris:'← → mover · ↑ girar · ↓ bajar · espacio caída rápida con puntos',flight:'Elige dificultad: cada 4 tuberías sube el nivel y aumenta el reto',bomber:'Muévete · una bomba al inicio · escapa de la onda · recoge mejoras de radio y bombas',maze:'Desliza o usa flechas · recoge puntos de poder · los fantasmas reviven tras un tiempo',tower:'Escala y salta barriles · recoge martillos (4 golpes) · evita fueguitos'};
  const gameTips={snake:'Cada manzana aumenta la velocidad. Puedes cruzar el borde y reaparecer al otro lado; evita tu propia cola.',galaga:'Derriba la formación, esquiva las ráfagas y aprovecha los destellos al eliminar enemigos.',tetris:'Completa varias filas a la vez para sumar más puntos. La pieza fantasma muestra dónde aterrizará.',flight:'Elige fácil, medio o difícil. La dificultad sube por niveles; incluso el modo fácil acaba acelerándose.',bomber:'Empiezas con una bomba. Las cajas esconden mejoras de radio o capacidad; toca y aléjate antes de la explosión.',maze:'Las bolitas grandes activan el poder. Los fantasmas capturados regresan al laberinto al cabo de unos segundos.',tower:'Recoge los martillos para cuatro golpes; los fueguitos y barriles recorren las plataformas.'};
  const gameTitles={snake:'¿Listo para jugar?',galaga:'¿Listo, piloto?',tetris:'¿Listo para apilar?',flight:'¡A volar!',bomber:'¡Enciende la mecha!',maze:'¡Waka waka!',tower:'¡A rescatar a Pauline!'};
  const gameDescriptions={snake:'Recoge las manzanas y evita chocar contigo mismo.',galaga:'Derriba la flota invasora, esquiva sus disparos y protege la galaxia.',tetris:'Gira y coloca las piezas para completar filas.',flight:'Guía al pajarito azul entre las tuberías y consigue la mejor puntuación.',bomber:'Destruye bloques con bombas, encuentra el camino y atrapa a los fantasmas.',maze:'Come todos los puntos del laberinto y escapa de los fantasmas.',tower:'Recoge repuestos, encuentra martillos con cuatro golpes y alcanza la cima de la torre.'};
  const gameIcons={snake:'🐍🍎',galaga:'👾',tetris:'🧩',flight:'🐦',bomber:'💣',maze:'🟡',tower:'🦍'};
  const gameTabLabels={snake:'Gusano & Manzana',galaga:'Galaga',tetris:'Tetris',flight:'Flappy Bird',bomber:'Bomberman',maze:'Pac-Man',tower:'Donkey Kong'};
  $$('.game-tab').forEach(tab=>{const label=gameTabLabels[tab.dataset.mode];if(label)tab.innerHTML=`<span aria-hidden="true">${gameIcons[tab.dataset.mode]}</span>${label}`});
  function selectGameMode(mode){
    if(!Object.hasOwn(gameModeNames,mode))return;
    if(game.mode===mode){if(mode==='galaga')renderGalaga();else if(mode==='tetris')renderTetris();else if(window.FeriaArcadeExtras.modes.has(mode))arcadeExtras.render(mode);return}
    gameCueTimers.forEach(clearTimeout);gameCueTimers=[];$('#arcadeCountdown').hidden=true;$('#arcadeCountdown').classList.remove('is-visible');
    $('#gameStart').disabled=false;$('#gameStart').hidden=false;$('#snakeDifficulty').hidden=true;
    if(game.running)pauseGame(true);
    game.mode=mode;game.paused=false;
    const extra=window.FeriaArcadeExtras.modes.has(mode);
    canvas.hidden=mode!=='snake'&&!extra;galagaCanvas.hidden=mode!=='galaga';tetrisCanvas.hidden=mode!=='tetris';
    canvas.setAttribute('aria-label',`${gameModeNames[mode]} · tablero de juego`);
    $('#gameModeName').textContent=gameModeNames[mode];$('#gameHint').textContent=gameHints[mode];$('#gameTip').textContent=gameTips[mode];
    $('#gameTipTitle').textContent=mode==='galaga'?'Consejo de piloto':mode==='tetris'?'Consejo de bloque':mode==='maze'?'Consejo de Pac-Man':mode==='tower'?'Consejo de Donkey Kong':mode==='bomber'?'Consejo de Bomberman':mode==='flight'?'Consejo de vuelo':'Consejo de juego';
    $('#gameMascot').innerHTML=mode==='snake'?'<div class="tiny-apple">●</div><div class="tiny-worm"><i></i><i></i><i></i></div><span>¡A por otra!</span>':`<div class="galaga-preview">${gameIcons[mode]||'✦'}</div><span>${gameModeNames[mode]}</span>`;
    fireButton.hidden=!['galaga','flight','bomber','tower'].includes(mode);
    $('#flightDifficulty').hidden=mode!=='flight';
    fireButton.innerHTML=mode==='galaga'?'FIRE <span>✦</span>':mode==='bomber'?'BOMBA <span>◆</span>':mode==='flight'?'ALETEAR <span>↑</span>':'MARTILLO <span>⚒</span>';
    fireButton.setAttribute('aria-label',mode==='galaga'?'Disparar':mode==='bomber'?'Colocar bomba':mode==='flight'?'Aletear':'Usar martillo');
    const jumpButton=$('#jumpButton');jumpButton.hidden=mode!=='tower';
    $$('.game-tab').forEach(tab=>{const active=tab.dataset.mode===mode;tab.classList.toggle('active',active);tab.setAttribute('aria-selected',String(active))});
    $('#bestScore').textContent=String(localStorage.getItem(`feria-${mode}-best`)||0).padStart(2,'0');renderLeaderboard(mode);$('#score').textContent='00';
    $('#gameEyebrow').textContent='RETO RÁPIDO';$('#gameTitle').textContent=gameTitles[mode];$('#gameMessage').textContent=gameDescriptions[mode];
    $('#gameStart').innerHTML='Empezar a jugar <span>→</span>';$('#recordCelebration').hidden=true;$('#recordCelebration').classList.remove('show','top-five');
    $('#gameOverlay').classList.remove('hidden','game-over','new-record','top-five-entry');
    if(mode==='galaga')renderGalaga();else if(mode==='tetris')renderTetris();else if(extra)arcadeExtras.render(mode);else renderGame();
  }
  $$('.game-tab').forEach(tab=>tab.addEventListener('click',()=>selectGameMode(tab.dataset.mode)));
  let touchStart=null;canvas.addEventListener('pointerdown',e=>{if(game.mode!=='snake'||!game.running)return;touchStart={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture?.(e.pointerId)});canvas.addEventListener('pointerup',e=>{if(!touchStart||e.pointerId!==touchStart.id)return;const dx=e.clientX-touchStart.x,dy=e.clientY-touchStart.y;touchStart=null;if(Math.max(Math.abs(dx),Math.abs(dy))<15)return;turn(Math.abs(dx)>Math.abs(dy)?{x:Math.sign(dx),y:0}:{x:0,y:Math.sign(dy)})});canvas.addEventListener('pointercancel',()=>{touchStart=null});
  let tetrTouch=null;tetrisCanvas.addEventListener('pointerdown',e=>{if(game.mode==='tetris'&&game.running){e.preventDefault();tetrTouch={id:e.pointerId,x:e.clientX,y:e.clientY};tetrisCanvas.setPointerCapture?.(e.pointerId)}});tetrisCanvas.addEventListener('pointerup',e=>{if(!tetrTouch||e.pointerId!==tetrTouch.id)return;const dx=e.clientX-tetrTouch.x,dy=e.clientY-tetrTouch.y;tetrTouch=null;if(Math.max(Math.abs(dx),Math.abs(dy))<18){rotateTetromino();return}if(Math.abs(dx)>Math.abs(dy)){const steps=Math.max(1,Math.round(Math.abs(dx)/28));for(let i=0;i<steps;i++)turn({x:Math.sign(dx),y:0})}else if(dy>0){if(dy>100){while(!tetrisCollision(0,1))tetr.y++;lockTetromino()}else tickTetris()}else rotateTetromino()});tetrisCanvas.addEventListener('pointercancel',()=>{tetrTouch=null});
  let galagaPointer=null,canvasFireTimer;function aimGalaga(e){const rect=galagaCanvas.getBoundingClientRect();if(rect.width)galaga.playerX=Math.max(22,Math.min(458,(e.clientX-rect.left)*480/rect.width))}galagaCanvas.addEventListener('pointerdown',e=>{if(!game.running||game.mode!=='galaga')return;e.preventDefault();galagaPointer=e.pointerId;galagaCanvas.setPointerCapture?.(e.pointerId);aimGalaga(e);fireGalaga();canvasFireTimer=setInterval(fireGalaga,190)});galagaCanvas.addEventListener('pointermove',e=>{if(game.mode==='galaga'&&game.running&&(e.pointerType==='mouse'?e.buttons===1:e.pointerId===galagaPointer))aimGalaga(e)});galagaCanvas.addEventListener('pointerup',e=>{if(e.pointerId===galagaPointer){galagaPointer=null;clearInterval(canvasFireTimer)}});galagaCanvas.addEventListener('pointercancel',()=>{galagaPointer=null;clearInterval(canvasFireTimer)});
  renderLeaderboard(game.mode);renderGame();renderGalaga();

})();
