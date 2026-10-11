import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const moviesDir = path.resolve(__dirname, '../movies');

if (!fs.existsSync(moviesDir)) {
  fs.mkdirSync(moviesDir, { recursive: true });
}

const outputFile = path.join(moviesDir, 'Family_Cinema_Demo.mp4');
const srtFile = path.join(moviesDir, 'Family_Cinema_Demo.srt');

console.log(`Generating test video with FFmpeg at: ${outputFile}`);

// Generate companion subtitles (.srt)
const srtContent = `1
00:00:01,000 --> 00:00:04,500
Welcome Mom to your Private Family Cinema!

2
00:00:05,000 --> 00:00:09,000
Watching over secure remote streaming connection.

3
00:00:10,000 --> 00:00:14,000
Adaptive qualities: 1080p, 720p, 480p and Direct Play.

4
00:00:15,000 --> 00:00:19,500
Subtitles are fully working with custom font size!

5
00:00:20,000 --> 00:00:25,000
You can pause, seek, or watch together anytime.

6
00:00:25,500 --> 00:00:29,500
Enjoy your movie! ❤️
`;

fs.writeFileSync(srtFile, srtContent, 'utf8');
console.log(`Created sample subtitle at: ${srtFile}`);

// ffmpeg command to generate test video with audio:
// Using testsrc2 or smptebars with drawtext
const ffmpegArgs = [
  '-y',
  '-f', 'lavfi',
  '-i', 'testsrc=duration=30:size=1920x1080:rate=30',
  '-f', 'lavfi',
  '-i', 'sine=frequency=440:sample_rate=44100:duration=30',
  '-c:v', 'libx264',
  '-pix_fmt', 'yuv420p',
  '-preset', 'ultrafast',
  '-b:v', '2500k',
  '-c:a', 'aac',
  '-b:a', '128k',
  '-af', 'volume=0.08',
  '-movflags', '+faststart',
  outputFile
];

const proc = spawn('ffmpeg', ffmpegArgs, { stdio: ['ignore', 'inherit', 'inherit'] });

proc.on('close', (code) => {
  if (code === 0) {
    console.log(`\n Successfully generated test movie: ${outputFile}`);
    console.log(`Size: ${(fs.statSync(outputFile).size / (1024 * 1024)).toFixed(2)} MB`);
  } else {
    console.error(`\n❌ FFmpeg failed with exit code: ${code}`);
  }
});
