import fs from "fs";
import readline from "readline";
import * as AudioPkg from "audio";

const path = "./songs";
const songs = fs.readdirSync(path).filter((el) => el.endsWith(".mp3"));

// Application State
let selected = 0;
let isPlaying = false;
let progressTimer = null;

// Audio State
let currentTime = 0;
let duration = 0;
let audioPlayer = null; 

// ==========================================
// 1. Terminal UI & Rendering Logic
// ==========================================
function render() {
  // Clear the terminal completely to prevent duplicate menus
  console.clear(); 

  const lines = [];
  lines.push(`🎶 Welcome to the Songs App 🎶\n`);

  for (let i = 0; i < songs.length; i++) {
    const marker = i === selected ? "👉" : "  ";
    const color = i === selected ? "\x1b[36m" : "\x1b[0m"; 
    lines.push(`${marker} ${color}${i + 1}: ${songs[i].split(".")[0]}\x1b[0m`);
  }

  lines.push(`\n[↑/↓] Navigate  |  [Enter] Play  |  [Space] Pause/Resume  |  [q] Quit`);
  lines.push(`[←/→] Rewind/Fast-Forward 5s`);

  if (audioPlayer && duration > 0) {
    lines.push(`\n🎵 Now Playing: ${songs[selected].split(".")[0]}`);
    
    const progress = Math.min(currentTime / duration, 1) || 0;
    const barSize = 30;
    const filled = Math.floor(progress * barSize);
    const bar = "█".repeat(filled) + "░".repeat(barSize - filled);

    const format = (sec) => `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, "0")}`;
    lines.push(`[${bar}] ${format(currentTime)} / ${format(duration)}`);
  }

  // Print everything
  process.stdout.write(lines.join("\n") + "\n");
}

// ==========================================
// 2. Audio Control using the `audio` package
// ==========================================
function playSong(index) {
  cleanUpCurrentSong();
  const songPath = `${path}/${songs[index]}`;
  
  // Safely find the module whether it's wrapped in default or not
  const Audio = AudioPkg.default || AudioPkg;

  try {
    if (typeof Audio.load === "function") {
      Audio.load(songPath).then(setupAudio);
    } else {
      // Fallback for older/different package versions
      const audioInstance = Audio(songPath);
      setupAudio(audioInstance);
    }
  } catch (err) {
    console.error("\nError loading audio file:", err);
  }
}

function setupAudio(audio) {
  audioPlayer = audio;
  audioPlayer.play();
  
  // Fallback to 180s if the buffer duration isn't instantly available
  duration = audioPlayer.duration || 180; 
  isPlaying = true;
  
  progressTimer = setInterval(() => {
    if (isPlaying && audioPlayer) {
      // Fetch real-time progress
      currentTime = audioPlayer.currentTime || 0;
      
      if (currentTime >= duration) {
        cleanUpCurrentSong(); 
      }
      render();
    }
  }, 1000);
  
  render();
}

function togglePause() {
  if (!audioPlayer) return;
  
  if (isPlaying) {
    audioPlayer.pause();
  } else {
    audioPlayer.play();
  }
  
  isPlaying = !isPlaying;
  render();
}

function skipTime(seconds) {
  if (!audioPlayer) return;
  
  // Adjust the currentTime property directly
  let newTime = Math.max(0, Math.min(audioPlayer.currentTime + seconds, duration));
  audioPlayer.currentTime = newTime;
  currentTime = newTime;
  
  render();
}

function cleanUpCurrentSong() {
  if (progressTimer) clearInterval(progressTimer);
  if (audioPlayer) {
    audioPlayer.pause(); 
    audioPlayer = null;
  }
  isPlaying = false;
  currentTime = 0;
  duration = 0;
}

function exitApp() {
  cleanUpCurrentSong();
  process.stdout.write("\x1b[?25h"); // Restore terminal cursor
  console.clear();
  process.exit(0);
}

// ==========================================
// 3. Keypress Event Listener
// ==========================================
readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);
process.stdout.write("\x1b[?25l"); // Hide terminal cursor

process.stdin.on("keypress", (str, key) => {
  if (key.name === "q" || (key.ctrl && key.name === "c")) {
    exitApp();
  }

  if (key.name === "up") {
    if (selected > 0) selected--;
    render();
  }

  if (key.name === "down") {
    if (selected < songs.length - 1) selected++;
    render();
  }

  if (key.name === "return") {
    playSong(selected);
  }

  if (key.name === "space" || key.name === "p") {
    togglePause();
  }

  if (key.name === "right") {
    skipTime(5); 
  }

  if (key.name === "left") {
    skipTime(-5); 
  }
});

// Start the app
render();