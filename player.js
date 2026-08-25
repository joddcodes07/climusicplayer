import fs from "fs";
import readline from "readline";
import path from "path";
import mpv from "node-mpv";

const songsFolder = "./songs";
const songs = fs.readdirSync(songsFolder).filter((el) => el.endsWith(".mp3"));

// Application State
let selected = 0;
let isPlaying = false;
let currentTime = 0;
let duration = 0;

// Initialize MPV Player
const audioPlayer = new mpv({ audio_only: true });

// Note: Some newer versions of node-mpv require manually starting the IPC socket
if (typeof audioPlayer.start === "function") {
  await audioPlayer.start();
}

// ==========================================
// 1. Terminal UI & Rendering Logic
// ==========================================
function render() {
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

  // Show progress bar if duration was successfully fetched
  if (duration > 0 || isPlaying) {
    lines.push(`\n🎵 Now Playing: ${songs[selected].split(".")[0]}`);
    
    // Prevent dividing by zero if duration hasn't loaded yet
    const safeDuration = duration > 0 ? duration : 1; 
    const progress = Math.min(currentTime / safeDuration, 1) || 0;
    
    const barSize = 30;
    const filled = Math.floor(progress * barSize);
    const bar = "█".repeat(filled) + "░".repeat(barSize - filled);

    const format = (sec) => `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, "0")}`;
    lines.push(`[${bar}] ${format(currentTime)} / ${format(duration)}`);
  }

  process.stdout.write(lines.join("\n") + "\n");
}

// ==========================================
// 2. Audio Control & Status Polling
// ==========================================

// Fallback Polling: Forcefully ask MPV for the time and duration every second
setInterval(async () => {
  if (isPlaying) {
    try {
      const pos = await audioPlayer.getProperty("time-pos");
      if (pos !== undefined) currentTime = pos;

      if (!duration) {
        const dur = await audioPlayer.getProperty("duration");
        if (dur !== undefined) duration = dur;
      }
      render();
    } catch (e) {
      // Ignore background IPC polling errors while track switches
    }
  }
}, 1000);

// Auto-cleanup when a song finishes
audioPlayer.on('stopped', () => {
  if (currentTime >= duration - 1 && duration > 0) {
    isPlaying = false;
    currentTime = 0;
    duration = 0;
    render();
  }
});

async function playSong(index) {
  // CRITICAL FIX: Give MPV the absolute path to your hard drive so it doesn't get lost
  const songPath = path.resolve(songsFolder, songs[index]);
  
  try {
    currentTime = 0;
    duration = 0;
    await audioPlayer.load(songPath);
    isPlaying = true;
    render();
  } catch (err) {
    console.error("\nPlayback error:", err);
  }
}

function togglePause() {
  if (isPlaying) {
    audioPlayer.pause();
  } else {
    audioPlayer.resume();
  }
  
  isPlaying = !isPlaying;
  render();
}

function skipTime(seconds) {
  // node-mpv handles relative seeking natively
  audioPlayer.seek(seconds);
  // Optimistically update the UI to prevent rendering lag
  currentTime = Math.max(0, currentTime + seconds); 
  render();
}

function exitApp() {
  audioPlayer.quit(); 
  process.stdout.write("\x1b[?25h"); 
  console.clear();
  process.exit(0);
}

// ==========================================
// 3. Keypress Event Listener
// ==========================================
readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);
process.stdout.write("\x1b[?25l"); 

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