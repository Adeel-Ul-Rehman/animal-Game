import { Howl, Howler } from 'howler';

/**
 * Sound Manager for Animal Battle Game
 * - Preloads all sounds on initialization
 * - Handles browser autoplay restrictions
 * - Provides instant playback with no delays
 * - Works correctly in production deployments
 */

class SoundManager {
  constructor() {
    this.sounds = {};
    this.initialized = false;
    // Read persisted mute preference — survives page reloads and React HMR
    // (the module-level singleton keeps its muted=true state across hot reloads,
    //  but the React isMuted state would reset to false, causing a silent mismatch)
    try {
      this.muted = localStorage.getItem('animalGame_muted') === 'true';
    } catch (e) {
      this.muted = false;
    }
    
    // Preload all game sounds
    this.loadSounds();
  }

  loadSounds() {
    // Define all game sounds with their configurations
    // html5: true is essential for all sounds — prevents Web Audio API
    // decoding failures that cause longer sounds (spin, win, lose) to play silently.
    const soundConfigs = {
      bgMusic: {
        src: ['/sounds/Training.mp3'],
        volume: 0.25,
        preload: true,
        html5: true,
        loop: true,
      },
      bet: {
        src: ['/sounds/bet.mp3'],
        volume: 0.5,
        preload: true,
        html5: true,
      },
      countdown: {
        src: ['/sounds/countdown.mp3'],
        volume: 0.6,
        preload: true,
        html5: true,
      },
      spin: {
        src: ['/sounds/spin.mp3'],
        volume: 0.5,
        preload: true,
        html5: true,
      },
      result: {
        src: ['/sounds/result.mp3'],
        volume: 0.5,
        preload: true,
        html5: true,
      },
      win: {
        src: ['/sounds/win.mp3'],
        volume: 0.7,
        preload: true,
        html5: true,
      },
      lose: {
        src: ['/sounds/lose.mp3'],
        volume: 0.5,
        preload: true,
        html5: true,
      },
    };

    // Create Howl instances for each sound
    Object.keys(soundConfigs).forEach((key) => {
      this.sounds[key] = new Howl({
        ...soundConfigs[key],
        onload: () => {
          console.log(`✅ Sound loaded: ${key}`);
        },
        onloaderror: (id, error) => {
          console.error(`❌ Failed to load sound: ${key}`, error);
        },
        onplayerror: (id, error) => {
          console.error(`❌ Failed to play sound: ${key}`, error);
          // Attempt to recover by unlocking and retrying once
          Howler.ctx && Howler.ctx.resume && Howler.ctx.resume().then(() => {
            this.sounds[key] && this.sounds[key].play();
          });
        },
      });
    });
  }

  /**
   * Initialize sound system (call after user interaction)
   * This is required for browsers with autoplay restrictions
   */
  init() {
    if (this.initialized) return;
    
    // Unlock audio context on mobile devices
    Howler.autoUnlock = true;
    
    // Apply persisted mute state to Howler on init
    if (this.muted) {
      Howler.mute(true);
    }
    
    this.initialized = true;
    console.log('🔊 Sound system initialized');
  }

  /**
   * Play a sound by name
   * @param {string} soundName - Name of the sound to play
   * @param {boolean} restart - If true, restart the sound from beginning
   * @returns {number|null} Sound ID if successful, null otherwise
   */
  play(soundName, restart = true) {
    if (!this.initialized) {
      this.init();
    }

    const sound = this.sounds[soundName];
    
    if (!sound) {
      console.warn(`⚠️ Sound not found: ${soundName}`);
      return null;
    }

    if (this.muted) {
      console.log(`🔇 Sound muted: ${soundName}`);
      return null;
    }

    try {
      if (restart) {
        sound.stop(); // Stop any currently playing instance
        sound.seek(0); // Explicitly reset to beginning — fixes html5 audio "plays once" bug
      }
      
      console.log(`🔊 Playing sound: ${soundName}`);
      const id = sound.play();
      return id;
    } catch (error) {
      console.error(`Error playing sound: ${soundName}`, error);
      return null;
    }
  }

  /**
   * Stop a specific sound
   * @param {string} soundName - Name of the sound to stop
   */
  stop(soundName) {
    const sound = this.sounds[soundName];
    if (sound) {
      try {
        sound.stop();
      } catch (e) {
        // Ignore stop errors — sound may not have been loaded or played yet
      }
    }
  }

  /**
   * Stop all sounds
   */
  stopAll() {
    Object.values(this.sounds).forEach((sound) => {
      sound.stop();
    });
  }

  /**
   * Fade out a sound over specified duration, then stop it
   * Works correctly with html5: true mode
   * @param {string} soundName - Name of the sound to fade out
   * @param {number} duration - Fade duration in milliseconds (default: 300ms)
   */
  fadeOut(soundName, duration = 300) {
    const sound = this.sounds[soundName];
    if (!sound || !sound.playing()) return;
    const originalVolume = sound.volume();
    sound.fade(originalVolume, 0, duration);
    setTimeout(() => {
      sound.stop();
      sound.volume(originalVolume); // Restore volume for next play
    }, duration + 50); // +50ms buffer to ensure fade completes
  }

  /**
   * Fade in a sound over specified duration
   * @param {string} soundName - Name of the sound to fade in
   * @param {number} targetVolume - Target volume (0.0 to 1.0)
   * @param {number} duration - Fade duration in milliseconds (default: 500ms)
   */
  fadeIn(soundName, targetVolume, duration = 500) {
    const sound = this.sounds[soundName];
    if (sound) {
      sound.volume(0);
      sound.play();
      sound.fade(0, targetVolume, duration);
    }
  }

  /**
   * Set volume for a specific sound
   * @param {string} soundName - Name of the sound
   * @param {number} volume - Volume level (0.0 to 1.0)
   */
  setVolume(soundName, volume) {
    const sound = this.sounds[soundName];
    if (sound) {
      sound.volume(volume);
    }
  }

  /**
   * Set global volume
   * @param {number} volume - Volume level (0.0 to 1.0)
   */
  setGlobalVolume(volume) {
    Howler.volume(volume);
  }

  /**
   * Mute all sounds
   */
  mute() {
    this.muted = true;
    Howler.mute(true);
    try { localStorage.setItem('animalGame_muted', 'true'); } catch (e) {}
  }

  /**
   * Unmute all sounds
   */
  unmute() {
    this.muted = false;
    Howler.mute(false);
    try { localStorage.setItem('animalGame_muted', 'false'); } catch (e) {}
  }

  /**
   * Toggle mute
   */
  toggleMute() {
    if (this.muted) {
      this.unmute();
    } else {
      this.mute();
    }
    return this.muted;
  }

  /**
   * Check if sounds are loaded
   */
  isLoaded(soundName) {
    const sound = this.sounds[soundName];
    return sound ? sound.state() === 'loaded' : false;
  }

  /**
   * Get all loaded sounds status
   */
  getLoadStatus() {
    const status = {};
    Object.keys(this.sounds).forEach((key) => {
      status[key] = this.sounds[key].state();
    });
    return status;
  }
}

// Create a singleton instance
const soundManager = new SoundManager();

export default soundManager;
