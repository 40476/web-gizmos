#!/usr/bin/env python3
import asyncio
import websockets
import json
import os
import numpy as np
import dbus
import sounddevice as sd
from aiohttp import web

# Default settings (mutable)
settings = {
    "SAMPLE_RATE": 44100,
    "CHUNK_SIZE": 1024,
    "FFT_SIZE": 1024,
    "NUM_BARS": 300,
    "SMOOTHING": 0.8,
    "SEND_INTERVAL": 0.015
}

smoothed_fft = np.zeros(settings["NUM_BARS"])

def get_mpris_metadata():
    try:
        bus = dbus.SessionBus()
        players = [s for s in bus.list_names() if s.startswith("org.mpris.MediaPlayer2.")]
        if not players:
            return "Unknown", "Unknown"
        player = bus.get_object(players[0], "/org/mpris/MediaPlayer2")
        iface = dbus.Interface(player, "org.freedesktop.DBus.Properties")
        metadata = iface.Get("org.mpris.MediaPlayer2.Player", "Metadata")
        title = str(metadata.get("xesam:title", "Unknown"))
        artist_list = metadata.get("xesam:artist", [])
        artist = str(artist_list[0]) if artist_list else "Unknown"
        return title, artist
    except Exception:
        return "Unknown", "Unknown"

def interpolate_fft(raw_fft, target_len):
    indices = np.linspace(0, len(raw_fft) - 1, target_len).astype(int)
    return raw_fft[indices]

def audio_callback(indata, frames, time, status):
    global smoothed_fft
    samples = indata[:, 0]
    fft_raw = np.abs(np.fft.rfft(samples, n=settings["FFT_SIZE"]))
    fft_raw = fft_raw[:settings["FFT_SIZE"] // 2]

    max_val = np.max(fft_raw)
    fft_norm = fft_raw / max_val if max_val > 0 else np.zeros_like(fft_raw)

    fft_interp = interpolate_fft(fft_norm, settings["NUM_BARS"])
    fft_interp = np.nan_to_num(fft_interp, nan=0.0, posinf=0.0, neginf=0.0)

    smoothed_fft = settings["SMOOTHING"] * smoothed_fft + (1 - settings["SMOOTHING"]) * fft_interp

async def stream_audio(websocket):
    while True:
        title, artist = get_mpris_metadata()
        fft_clean = np.nan_to_num(smoothed_fft * 100, nan=0.0).tolist()
        data = {
            "fft": fft_clean,
            "title": title,
            "artist": artist
        }
        await websocket.send(json.dumps(data))
        await asyncio.sleep(settings["SEND_INTERVAL"])

async def websocket_handler(websocket):
    await stream_audio(websocket)

# --- Web Interface Handlers ---

async def get_settings(request):
    return web.json_response(settings)

async def update_settings(request):
    try:
        new_settings = await request.json()
        for key in settings:
            if key in new_settings:
                settings[key] = type(settings[key])(new_settings[key])
        return web.json_response({"status": "updated", "settings": settings})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=400)

async def start_servers():
    print("Starting audio server on ws://localhost:43374 and HTTP server on http://localhost:8080")

    base_dir = os.path.dirname(os.path.abspath(__file__))
    static_dir = os.path.join(base_dir)

    app = web.Application()

    # Serve static files from /static/
    app.router.add_static('/', static_dir, show_index=True)

    # Serve index.html at root
    async def index(request):
        return web.FileResponse(os.path.join(static_dir, 'index.html'))

    app.router.add_get('/', index)

    # API endpoints
    app.router.add_get('/settings', get_settings)
    app.router.add_post('/settings', update_settings)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, 'localhost', 8080)
    await site.start()

    with sd.InputStream(channels=1, samplerate=settings["SAMPLE_RATE"],
                        blocksize=settings["CHUNK_SIZE"], callback=audio_callback):
        async with websockets.serve(websocket_handler, "localhost", 43374):
            await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(start_servers())
