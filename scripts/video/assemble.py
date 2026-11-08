import json, subprocess

marks = json.load(open('marks.json'))
ids = [s['id'] for s in json.load(open('script.json'))]
order = ids + ['end']

def dur(p):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p]))

parts, total = [], 0.0
for i, sid in enumerate(ids):
    start, end = marks[sid], marks[order[i + 1]]
    D = end - start
    N = dur(f'audio/{sid}.wav')
    T = round(N + 0.8, 3)
    out = f'seg_{i:02d}.mp4'
    speed = max(1.0, D / T)
    vf = [f'trim=start={start}:end={end}', 'setpts=PTS-STARTPTS']
    if speed > 1.0:
        vf.append(f'setpts=PTS/{speed:.4f}')
    vf += [f'tpad=stop_mode=clone:stop_duration={T}', f'trim=duration={T}', 'setpts=PTS-STARTPTS',
           'scale=1920:1080:flags=lanczos', 'fps=30', 'format=yuv420p']
    af = f'adelay=250|250,apad=whole_dur={T},atrim=duration={T},aresample=48000'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', 'raw.webm', '-i', f'audio/{sid}.wav',
                    '-filter_complex', f"[0:v]{','.join(vf)}[v];[1:a]{af}[a]",
                    '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
                    '-c:a', 'aac', '-b:a', '160k', '-ac', '2', out], check=True)
    parts.append(out); total += T
    print(f'{sid}: clip {D:5.1f}s → {T:5.1f}s (speed {speed:.2f}x)')

open('parts.txt', 'w').write(''.join(f"file '{p}'\n" for p in parts))
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', 'parts.txt', '-c', 'copy', 'joined.mp4'], check=True)
T = dur('joined.mp4')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', 'joined.mp4',
                '-vf', f'fade=t=in:st=0:d=0.6,fade=t=out:st={T - 0.9:.2f}:d=0.9',
                '-af', f'afade=t=in:st=0:d=0.3,afade=t=out:st={T - 0.9:.2f}:d=0.9,loudnorm=I=-16:TP=-1.5:LRA=11',
                '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-c:a', 'aac', '-b:a', '160k',
                '-movflags', '+faststart', 'fairpay-demo.mp4'], check=True)
print(f'TOTAL {dur("fairpay-demo.mp4"):.1f}s')
