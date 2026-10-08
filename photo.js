import { FilesetResolver, ImageSegmenter } from './assets/models/mediapipe/vision_bundle.mjs';

(() => {
  const $ = q => document.querySelector(q);
  const video = $('#cameraPreview');
  const canvas = $('#photoCanvas');
  const ctx = canvas.getContext('2d');
  const originalPhoto = document.createElement('canvas');
  const originalPhotoCtx = originalPhoto.getContext('2d');
  const source = document.createElement('canvas');
  const sourceCtx = source.getContext('2d', { willReadFrequently: true });
  const matte = document.createElement('canvas');
  const matteCtx = matte.getContext('2d', { willReadFrequently: true });
  const buttons = { start: $('#cameraStart'), capture: $('#capturePhoto'), retake: $('#retakePhoto'), save: $('#savePhoto') };
  const scenes = {
    tecnologia:'assets/fondos/tecnologia.svg',
    programacion:'assets/fondos/programacion.svg',
    feria:'assets/fondos/Feria%20empresarial_%20c%C3%B3digo%20y%20gaming%20futurista.png',
    innovacion:'assets/fondos/innovacion.svg'
  };
  const images = {};
  const frameOverlay = new Image();
  let frameReady=false,frameEnabled=false;
  frameOverlay.onload=()=>{frameReady=true;drawComposition()};
  frameOverlay.src='assets/fondos/marco-arcade.svg';
  let stream = null, segmenter = null, segmenterPromise = null, sourcePixels = null, personCanvas = null, scene = 'feria', processingTimer, confidenceValues = null, confidenceWidth = 0, confidenceHeight = 0;
  const threshold = $('#matteThreshold');
  const status = $('#photoStatus');
  const modelStatus = $('#modelStatus');
  const placeholder = $('#photoPlaceholder');

  function toast(message) {
    const el = $('#toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(processingTimer); processingTimer = setTimeout(() => el.classList.remove('show'), 3500);
  }
  function stopCamera() {
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = null; video.srcObject = null; video.hidden = true;
  }
  function updateCaptureGuide(){
    if(!stream||!video.videoWidth||!video.videoHeight)return;
    const box=video.parentElement.getBoundingClientRect();
    const scale=Math.min(box.width/video.videoWidth,box.height/video.videoHeight);
    const cropWidth=Math.min(video.videoWidth,video.videoHeight*.96);
    const frameWidth=cropWidth*scale/box.width*100;
    video.parentElement.style.setProperty('--capture-frame-width',`${frameWidth}%`);
    video.parentElement.style.setProperty('--capture-frame-left',`${50-frameWidth/2}%`);
  }
  async function loadSegmenter() {
    if (segmenter) return segmenter;
    if (!segmenterPromise) {
      modelStatus.textContent = 'CARGANDO MODELO LOCAL';
      segmenterPromise = (async () => {
        const vision = await FilesetResolver.forVisionTasks(new URL('./assets/models/mediapipe/wasm/', import.meta.url).href);
        segmenter = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: { modelAssetPath: new URL('./assets/models/mediapipe/selfie_segmenter.tflite', import.meta.url).href, delegate: 'CPU' },
          runningMode: 'IMAGE', outputCategoryMask: false, outputConfidenceMasks: true
        });
        modelStatus.textContent = 'RECORTE LOCAL LISTO';
        if (stream) buttons.capture.disabled = false;
        return segmenter;
      })().catch(error => {
        modelStatus.textContent = 'MODELO NO DISPONIBLE';
        segmenterPromise = null;
        console.error('No se pudo cargar el modelo local de recorte.', error);
        throw error;
      });
    }
    return segmenterPromise;
  }
  async function openCamera() {
    if (stream) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      toast('Abre la feria con abrir-feria.bat o desde HTTPS para habilitar la cámara.');
      return;
    }
    const modelTask = scene==='sin-fondo'?Promise.resolve(null):loadSegmenter();
    if(scene!=='sin-fondo')modelTask.catch(() => toast('No se pudo cargar el modelo local. Revisa los archivos de assets/models.'));
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio:false, video:{ facingMode:'user', width:{ideal:1280}, height:{ideal:720} } });
      video.srcObject = stream; video.hidden = false; await video.play();
      canvas.classList.add('camera-ready');video.parentElement.classList.add('camera-live');placeholder.classList.add('hidden');requestAnimationFrame(updateCaptureGuide);
      buttons.start.innerHTML = 'Cámara activa <span>&#10003;</span>';
      buttons.capture.disabled = scene!=='sin-fondo'&&!segmenter; status.textContent = 'ENCUADRA TU FOTO';
      toast('Cámara lista. El recorte local se prepara en este dispositivo.');
    } catch (error) {
      stopCamera();
      const message = error.name === 'NotAllowedError' ? 'Permite el acceso a la cámara en el navegador para continuar.' : 'No se pudo iniciar la cámara. Comprueba que esté disponible e inténtalo otra vez.';
      toast(message);
      modelTask.catch(() => {});
    }
  }

  function largestForegroundRegion(values,width,height,minimum){
    const size=width*height,visited=new Uint8Array(size),queue=new Int32Array(size);
    let bestStart=-1,bestSize=0;
    for(let start=0;start<size;start++){
      if(visited[start]||values[start]<minimum)continue;
      let head=0,tail=0;queue[tail++]=start;visited[start]=1;
      while(head<tail){
        const index=queue[head++],x=index%width,y=(index/width)|0;
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
          if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;
          if(nx<0||ny<0||nx>=width||ny>=height)continue;
          const next=ny*width+nx;
          if(!visited[next]&&values[next]>=minimum){visited[next]=1;queue[tail++]=next;}
        }
      }
      if(tail>bestSize){bestStart=start;bestSize=tail;}
    }
    if(bestStart<0)return null;
    const keep=new Uint8Array(size);let head=0,tail=0;queue[tail++]=bestStart;keep[bestStart]=1;
    while(head<tail){
      const index=queue[head++],x=index%width,y=(index/width)|0;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;
        if(nx<0||ny<0||nx>=width||ny>=height)continue;
        const next=ny*width+nx;
        if(!keep[next]&&values[next]>=minimum){keep[next]=1;queue[tail++]=next;}
      }
    }
    return keep;
  }
  function softenConfidenceMask(maskValues, width, height, cutoff) {
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = width; maskCanvas.height = height;
    const maskContext = maskCanvas.getContext('2d');
    const pixels = maskContext.createImageData(width,height);
    const low=Math.max(.08,cutoff-.2), high=Math.min(.99,cutoff+.13), span=high-low;
    const keep=largestForegroundRegion(maskValues,width,height,Math.max(.12,cutoff-.24));
    for(let i=0;i<maskValues.length;i++){
      const x=keep&&!keep[i]?0:Math.max(0,Math.min(1,(maskValues[i]-low)/span));
      const alpha=x*x*(3-2*x), p=i*4;
      pixels.data[p]=pixels.data[p+1]=pixels.data[p+2]=255;
      pixels.data[p+3]=Math.round(alpha*255);
    }
    maskContext.putImageData(pixels,0,0);
    matte.width=source.width; matte.height=source.height;
    matteCtx.clearRect(0,0,matte.width,matte.height);
    matteCtx.imageSmoothingEnabled=true; matteCtx.imageSmoothingQuality='high';
    matteCtx.filter='blur(1px)';
    matteCtx.drawImage(maskCanvas,0,0,matte.width,matte.height);
    matteCtx.filter='none';
    const alpha=matteCtx.getImageData(0,0,matte.width,matte.height).data;
    const output=sourceCtx.createImageData(source.width,source.height);
    output.data.set(sourcePixels.data);
    for(let i=0;i<source.width*source.height;i++)output.data[i*4+3]=Math.round(output.data[i*4+3]*alpha[i*4+3]/255);
    sourceCtx.putImageData(output,0,0);
    personCanvas=source;
  }
  function applyModelMask() {
    if(!segmenter||!sourcePixels)throw new Error('El modelo local todavia no esta listo.');
    sourceCtx.putImageData(sourcePixels,0,0);
    const result=segmenter.segment(source);
    try {
      const masks=result.confidenceMasks||[];
      if(!masks.length)throw new Error('El modelo no devolvio una mascara.');
      const labels=(segmenter.getLabels()||[]).map(label=>label.toLowerCase());
      const personIndex=labels.findIndex(label=>label.includes('person'));
      const selected=personIndex>=0&&masks[personIndex]?masks[personIndex]:masks.length>1?masks[1]:masks[0];
      confidenceValues=new Float32Array(selected.getAsFloat32Array());
      confidenceWidth=selected.width;confidenceHeight=selected.height;
      renderCutout();
    } finally { result.close(); }
  }
  function renderCutout(){
    if(!sourcePixels||!confidenceValues)return;
    sourceCtx.putImageData(sourcePixels,0,0);
    softenConfidenceMask(confidenceValues,confidenceWidth,confidenceHeight,Number(threshold.value)/100);
  }
  function prepareOriginalPhotoForCutout(){
    const cropW=Math.min(originalPhoto.width,originalPhoto.height*.96),sx=(originalPhoto.width-cropW)/2;
    source.width=720;source.height=750;
    sourceCtx.drawImage(originalPhoto,sx,0,cropW,originalPhoto.height,0,0,source.width,source.height);
    sourcePixels=sourceCtx.getImageData(0,0,source.width,source.height);
    confidenceValues=null;
    applyModelMask();
  }
  function drawComposition() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(scene==='sin-fondo'){
      if(originalPhoto.width)ctx.drawImage(originalPhoto,0,0,canvas.width,canvas.height);
    }else if(images[scene])ctx.drawImage(images[scene],0,0,canvas.width,canvas.height);
    else { const grad=ctx.createLinearGradient(0,0,900,600);grad.addColorStop(0,'#12364c');grad.addColorStop(1,'#091522');ctx.fillStyle=grad;ctx.fillRect(0,0,900,600); }
    if(frameEnabled&&scene==='sin-fondo'&&frameReady)ctx.drawImage(frameOverlay,0,0,canvas.width,canvas.height);
    if(personCanvas&&scene!=='sin-fondo'){
      const scale=Math.min(535/personCanvas.height,530/personCanvas.width),w=personCanvas.width*scale,h=personCanvas.height*scale,x=(900-w)/2,y=600-h-7;
      ctx.save();ctx.shadowColor='rgba(2,8,15,.42)';ctx.shadowBlur=20;ctx.shadowOffsetY=8;ctx.drawImage(personCanvas,x,y,w,h);ctx.restore();
      placeholder.classList.add('hidden');buttons.save.disabled=false;status.textContent='FOTO LISTA · ELIGE TU FONDO';
    }else if(scene==='sin-fondo'&&originalPhoto.width){placeholder.classList.add('hidden');buttons.save.disabled=false;status.textContent=frameEnabled?'FOTO ORIGINAL + MARCO':'FOTO ORIGINAL - FONDO INTACTO';}
    else {buttons.save.disabled=true;if(!stream)placeholder.classList.remove('hidden')}
  }
  async function capture() {
    if(!stream||video.readyState<2)return;
    if(scene!=='sin-fondo'&&!segmenter){toast('Espera a que termine de cargar el modelo local.');return}
    const vw=video.videoWidth,vh=video.videoHeight,photoCropW=Math.min(vw,vh*canvas.width/canvas.height),photoSx=(vw-photoCropW)/2;
    originalPhoto.width=canvas.width;originalPhoto.height=canvas.height;
    originalPhotoCtx.save();originalPhotoCtx.translate(originalPhoto.width,0);originalPhotoCtx.scale(-1,1);originalPhotoCtx.drawImage(video,photoSx,0,photoCropW,vh,0,0,originalPhoto.width,originalPhoto.height);originalPhotoCtx.restore();
    if(scene==='sin-fondo'){
      personCanvas=null;sourcePixels=null;confidenceValues=null;video.hidden=true;$('.photo-canvas-wrap').classList.remove('camera-live');canvas.classList.remove('camera-ready');buttons.capture.disabled=true;buttons.retake.hidden=false;buttons.start.hidden=true;$('#photoTools').hidden=true;stopCamera();drawComposition();toast(frameEnabled?'Foto original lista con su marco.':'Foto lista: conservamos el fondo original.');return;
    }
    const cropW=Math.min(vw,vh*.96),sx=(vw-cropW)/2;
    source.width=720;source.height=750;
    sourceCtx.save();sourceCtx.translate(source.width,0);sourceCtx.scale(-1,1);sourceCtx.drawImage(video,sx,0,cropW,vh,0,0,source.width,source.height);sourceCtx.restore();
    sourcePixels=sourceCtx.getImageData(0,0,source.width,source.height);confidenceValues=null;
    video.hidden=true;$('.photo-canvas-wrap').classList.remove('camera-live');canvas.classList.remove('camera-ready');buttons.capture.disabled=true;buttons.retake.hidden=false;buttons.start.hidden=true;$('#photoTools').hidden=false;
    status.textContent='PROCESSING...';$('#matteValue').value=threshold.value;
    stopCamera();
    await new Promise(resolve=>setTimeout(resolve,50));
    try {
      applyModelMask();drawComposition();status.textContent='READY! · FOTO LISTA';toast('¡Foto lista! Puedes afinar el contorno, elegir el fondo y guardar.');
    } catch(error) {
      console.error('Falló el recorte local.',error);status.textContent='NO SE PUDO RECORTAR';toast('No se pudo recortar la imagen. Vuelve a tomar la foto e inténtalo otra vez.');
    }
  }
  const countdown = $('#photoCountdown');
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function captureSequence() {
    if(!stream||video.readyState<2)return;
    if(scene!=='sin-fondo'&&!segmenter){toast('Espera a que termine de cargar el modelo local.');return}
    buttons.capture.disabled=true;
    for (const beat of ['3','2','1','SNAP!']) {
      window.dispatchEvent(new CustomEvent('feria:sound',{detail:{cue:beat==='SNAP!'?'photo':'hover'}}));
      countdown.textContent=beat;countdown.classList.remove('photo-cue-on','photo-cue-snap');
      void countdown.offsetWidth;countdown.classList.add('photo-cue-on');
      if(beat==='SNAP!'){
        countdown.classList.add('photo-cue-snap');$('.photo-canvas-wrap').classList.add('photo-flashing');
        const stage=$('.photo-canvas-wrap').getBoundingClientRect();
        window.dispatchEvent(new CustomEvent('feria:burst',{detail:{x:stage.left+stage.width/2,y:stage.top+stage.height/2,strength:1.35}}));
      }
      await wait(beat==='SNAP!'?320:620);
      $('.photo-canvas-wrap').classList.remove('photo-flashing');
    }
    countdown.classList.remove('photo-cue-on','photo-cue-snap');countdown.textContent='';
    await capture();
  }
  function retake() {
    personCanvas=null;sourcePixels=null;confidenceValues=null;originalPhoto.width=0;originalPhoto.height=0;buttons.save.disabled=true;buttons.retake.hidden=true;buttons.start.hidden=false;
    buttons.start.innerHTML='Activar c&aacute;mara <span>&#8599;</span>';$('#photoTools').hidden=true;
    placeholder.classList.remove('hidden');drawComposition();openCamera();
  }
  Object.entries(scenes).forEach(([key,src])=>{const image=new Image();image.onload=()=>{images[key]=image;drawComposition()};image.src=src});
  buttons.start.addEventListener('click',openCamera);
  buttons.capture.addEventListener('click',captureSequence);
  buttons.retake.addEventListener('click',retake);
  threshold.addEventListener('input',()=>{
    $('#matteValue').value=threshold.value;
    if(sourcePixels&&confidenceValues){try{renderCutout();drawComposition()}catch(error){console.error(error);toast('No se pudo actualizar el contorno.')}}
  });
  const sceneDetails={tecnologia:['Tecnolog\u00eda','Luz en movimiento','\u2726'],programacion:['Programaci\u00f3n','C\u00f3digo en acci\u00f3n','</>'],feria:['Feria empresarial','Un d\u00eda para recordar','\u25c7'],innovacion:['Innovaci\u00f3n','Ideas hacia el futuro','\u2727'],'sin-fondo':['Foto original','Fondo original intacto','\u25a1']};
  function updateSceneSelection(){
    const detail=sceneDetails[scene]||sceneDetails.feria,art=$('#sceneSelectedArt'),preview=$('#sceneSelectedPreview');
    if(scene!=='sin-fondo')frameEnabled=false;
    const frameButton=$('.scene-choice[data-scene="marco"]');frameButton.disabled=scene!=='sin-fondo';frameButton.setAttribute('aria-disabled',String(frameButton.disabled));
    if(stream)buttons.capture.disabled=scene!=='sin-fondo'&&!segmenter;
    $('#sceneSelectedName').textContent=frameEnabled?`${detail[0]} + marco`:detail[0];$('#sceneSelectedHint').textContent=frameEnabled?'Marco arcade superpuesto':detail[1];preview.classList.toggle('frame-active',frameEnabled);preview.dataset.scene=scene;art.className=`scene-selected-art scene-${scene==='programacion'?'code':scene==='innovacion'?'idea':scene==='tecnologia'?'tech':scene==='sin-fondo'?'empty':'fair'}`;art.textContent=detail[2];
    preview.classList.remove('scene-selection-pulse');void preview.offsetWidth;preview.classList.add('scene-selection-pulse');
    document.querySelectorAll('.scene-choice').forEach(item=>{const selected=item.dataset.scene==='marco'?frameEnabled:item.dataset.scene===scene;item.classList.toggle('selected',selected);item.setAttribute('aria-pressed',String(selected))});
  }
  document.querySelectorAll('.scene-choice').forEach(button=>button.addEventListener('click',async()=>{
    if(button.dataset.scene==='marco'){if(scene!=='sin-fondo')return;frameEnabled=!frameEnabled}
    else scene=button.dataset.scene;
    updateSceneSelection();drawComposition();
    if(scene==='sin-fondo'||button.dataset.scene==='marco')return;
    if(stream&&!segmenter)loadSegmenter().then(()=>{if(stream)buttons.capture.disabled=false}).catch(()=>toast('No se pudo cargar el recorte local.'));
    else if(originalPhoto.width&&!personCanvas){
      status.textContent='RECORTANDO PERSONA…';
      try{await loadSegmenter();prepareOriginalPhotoForCutout();drawComposition();status.textContent='FOTO LISTA · ELIGE TU FONDO'}
      catch(error){console.error('No se pudo recortar la foto original.',error);status.textContent='NO SE PUDO RECORTAR';toast('No se pudo preparar el recorte. La foto original sigue disponible.')}
    }
  }));
  updateSceneSelection();
  buttons.save.addEventListener('click',()=>{
    if(!personCanvas&&!originalPhoto.width)return;
    canvas.toBlob(blob=>{if(!blob){toast('No se pudo guardar la imagen.');return}const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='recuerdo-feria-empresarial.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Recuerdo guardado en tu dispositivo.')},'image/png');
  });
  video.addEventListener('loadedmetadata',()=>{updateCaptureGuide();if(stream&&(segmenter||scene==='sin-fondo'))buttons.capture.disabled=false});
  addEventListener('resize',updateCaptureGuide,{passive:true});
  drawComposition();
  function closeForNavigation(){stopCamera();$('.photo-canvas-wrap').classList.remove('camera-live');if(!personCanvas&&!originalPhoto.width){buttons.start.hidden=false;buttons.start.innerHTML='Activar c&aacute;mara <span>&#8599;</span>';buttons.capture.disabled=true;canvas.classList.remove('camera-ready');placeholder.classList.remove('hidden')}}
  window.FeriaPhoto={close:closeForNavigation};
})();
