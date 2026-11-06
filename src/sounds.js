// Original synthesized wood-on-wood taps. No third-party audio samples.
let context;
let noiseBuffer;
function audioContext() {
  context ||= new (window.AudioContext||window.webkitAudioContext)();
  if(context.state==='suspended') void context.resume();
  if(!noiseBuffer) {
    noiseBuffer=context.createBuffer(1,Math.ceil(context.sampleRate*.09),context.sampleRate);
    const data=noiseBuffer.getChannelData(0);
    // Repeatable, short broadband impulse: click, not a pitched notification beep.
    let seed=0x360;
    for(let i=0;i<data.length;i++) {seed=(Math.imul(seed,1664525)+1013904223)|0;data[i]=(seed/2147483648)*Math.exp(-i/(context.sampleRate*.015));}
  }
  return context;
}
function tap(at,loudness,pitch) {
  const ctx=audioContext(),src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
  src.buffer=noiseBuffer;filter.type='bandpass';filter.frequency.value=pitch;filter.Q.value=.65;
  gain.gain.setValueAtTime(.0001,at);
  gain.gain.exponentialRampToValueAtTime(loudness,at+.002);
  gain.gain.exponentialRampToValueAtTime(.0001,at+.075);
  src.connect(filter);filter.connect(gain);gain.connect(ctx.destination);
  src.start(at);src.stop(at+.08);
  // Quiet low-frequency resonance gives the wood piece some weight.
  const resonator=ctx.createOscillator(),lowGain=ctx.createGain();
  resonator.type='triangle';resonator.frequency.setValueAtTime(200,at);
  resonator.frequency.exponentialRampToValueAtTime(100,at+.05);
  lowGain.gain.setValueAtTime(.0001,at);
  lowGain.gain.exponentialRampToValueAtTime(loudness*.17,at+.003);
  lowGain.gain.exponentialRampToValueAtTime(.0001,at+.06);
  resonator.connect(lowGain);lowGain.connect(ctx.destination);
  resonator.start(at);resonator.stop(at+.07);
}
export function playWoodSound(kind='move') {
  try {
    const now=audioContext().currentTime+.004;
    if(kind==='pickup')tap(now,.065,1500);
    else if(kind==='capture') {tap(now,.22,850);tap(now+.025,.12,1550);}
    else tap(now,.16,1250);
  } catch { /* Browsers that block audio still play chess normally. */ }
}
