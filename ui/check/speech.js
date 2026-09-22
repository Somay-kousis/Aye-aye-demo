// The browser's speech APIs, the one thing allowed to leave the machine: speechSynthesis
// is local, webkitSpeechRecognition sends audio to Google. Chrome only. Both need a user
// gesture, so nothing here runs until arm() is called from a keydown.

// Named voices in order of preference, so a take sounds the same after an OS update. The
// chosen voice is logged at arm time and on the first speak.
const VOICES = ['Daniel', 'Samantha', 'Karen', 'Moira', 'Rishi'];
const RECOGNITION_LANG = 'en-GB';
const VOICES_WAIT = 1000;        // for voiceschanged after the first empty getVoices()
const PROBE_TIMEOUT = 2000;      // a silent utterance that never starts means TTS is dead
const SPEAK_MS_PER_CHAR = 60;    // fallback: arm recognition after this long per character
const SPEAK_MIN = 2000;
const SPEAK_MAX = 15000;

export function createSpeech({ log = (...a) => console.log('[speech]', ...a) } = {}) {
  let voice = null;
  let ttsOk = false;
  let stream = null;
  let spokeOnce = false;

  function pickVoice() {
    const all = speechSynthesis.getVoices();
    for (const name of VOICES) {
      const v = all.find((x) => x.name === name);
      if (v) return v;
    }
    return all.find((v) => v.localService && v.lang.startsWith('en')) ?? all.find((v) => v.lang.startsWith('en')) ?? all[0] ?? null;
  }

  function voicesLoaded() {
    if (speechSynthesis.getVoices().length) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => { speechSynthesis.removeEventListener('voiceschanged', done); resolve(); };
      speechSynthesis.addEventListener('voiceschanged', done);
      setTimeout(done, VOICES_WAIT);
    });
  }

  // Speaks nothing audible and waits for `start`: proves the engine answers, not just that
  // the API object exists.
  async function probeTts() {
    if (!('speechSynthesis' in window)) { log('tts: speechSynthesis unavailable'); return false; }
    await voicesLoaded();
    voice = pickVoice();
    if (!voice) { log('tts: no voices loaded'); return false; }
    const ok = await new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance('ready');
      u.voice = voice;
      u.volume = 0;
      const timer = setTimeout(() => resolve(false), PROBE_TIMEOUT);
      u.onstart = () => { clearTimeout(timer); resolve(true); };
      u.onerror = () => { clearTimeout(timer); resolve(false); };
      speechSynthesis.speak(u);
    });
    speechSynthesis.cancel();
    log(ok ? `tts: voice "${voice.name}" (${voice.lang}${voice.localService ? ', local' : ''})` : `tts: voice "${voice.name}" never started`);
    return ok;
  }

  async function probeMic() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      log(`mic: ${stream.getAudioTracks()[0]?.label || 'audio track'}`);
      return true;
    } catch (err) {
      log(`mic: ${err.name}: ${err.message}`);
      return false;
    }
  }

  async function arm() {
    const [tts, mic] = await Promise.all([probeTts(), probeMic()]);
    ttsOk = tts;
    return { tts, mic, stream };
  }

  // Resolves when the utterance ends, or after a length-derived timeout if the engine is
  // missing, voiceless, or never fires `end`. First wins, once. The demo never waits on a
  // callback that is not coming.
  function speak(text, spoken) {
    const say = String(spoken ?? text).replace(/`/g, '');
    const budget = Math.min(SPEAK_MAX, Math.max(SPEAK_MIN, say.length * SPEAK_MS_PER_CHAR + 500));
    return new Promise((resolve) => {
      let done = false;
      const finish = (how) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        log(`spoke (${how}): ${say}`);
        resolve(how);
      };
      const timer = setTimeout(() => finish('timeout'), budget);
      if (!ttsOk || !voice) return;
      const u = new SpeechSynthesisUtterance(say);
      u.voice = voice;
      u.lang = voice.lang;
      if (!spokeOnce) { spokeOnce = true; log(`tts: speaking with "${voice.name}"`); }
      u.onend = () => finish('end');
      u.onerror = (e) => finish(`error ${e.error}`);
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    });
  }

  // Continuous recognition with interim results. Chrome ends a session on its own with
  // `no-speech` when the presenter pauses before answering; that is restarted until a result
  // arrives or stop() is called, so the mic never looks live while capturing nothing.
  function listen({ onResult }) {
    const Recognition = window.webkitSpeechRecognition ?? window.SpeechRecognition;
    if (!Recognition) { log('recognition: unavailable'); return { stop() {} }; }
    let active = true;
    let gotResult = false;
    let rec = null;
    let restarts = 0;

    function start() {
      rec = new Recognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = RECOGNITION_LANG;
      rec.onresult = (e) => {
        gotResult = true;
        let text = '';
        for (const r of e.results) text += r[0].transcript;
        onResult(text.trim());
      };
      rec.onerror = (e) => {
        if (!active) return;
        if (e.error === 'no-speech') return; // `end` follows; restart there
        log(`recognition: error ${e.error}`);
      };
      rec.onend = () => {
        if (!active || gotResult) return;
        restarts++;
        log(`recognition: ended with no speech, restart ${restarts}`);
        start();
      };
      rec.start();
    }
    start();
    log('recognition: listening');

    return {
      stop() {
        active = false;
        try { rec?.stop(); } catch { /* already stopped */ }
      },
    };
  }

  return { arm, speak, listen, get stream() { return stream; } };
}
