# Orbit Conference — Realtime Translator Architecture

This document mirrors the intended production architecture for realtime translation in Orbit Conference, including captions fanout and Gemini Live read‑aloud.

## High-level flow (shared vs per listener)

Shared (per room / per speaker track):
- Audio tap → VAD/segmenter → streaming STT → stabilized transcript (partial + final).

Per listener (or per target-language group):
- Translation → caption formatting → Gemini Live read‑aloud session (because each listener may choose a different target language and speaking style).

```mermaid
flowchart LR
  subgraph Speaker Side
    S1[Speaker Mic] --> S2[WebRTC PeerConnection]
  end

  subgraph Core Media
    SFU[SFU / Media Server]:::core
  end

  subgraph Pipeline
    TAP[Audio Tap / PCM Fork] --> VAD[VAD + Segmenter]
    VAD --> STT[Streaming STT Engine]
    STT --> NORM[Stabilize + Punctuate + LID]
    NORM --> TR[Translator]
    TR --> CAP[Caption Publisher]
    TR --> GLA[Gemini Live Audio Session\n(native audio read-aloud)]
  end

  subgraph Listener Side
    L1[Listener WebRTC] --> L2[Playback Original Audio]
    CAP --> L3[Caption UI]
    GLA --> L4[Playback Translated Read-Aloud]
  end

  S2 --> SFU
  SFU --> L1
  SFU --> TAP

  classDef core fill:#f3f3f3,stroke:#333,stroke-width:1px;
```

## Runtime channels

1) WebRTC media (RTP/Opus)
- Speaker audio/video → SFU → listeners (original call media)

2) Captions channel (WebSocket OR WebRTC DataChannel)
- Server → listeners: partial + final caption updates

3) Gemini Live channel (WebSocket session)
- Server ↔ Gemini Live API for native audio responses (read‑aloud)

## Message payloads (copyable shapes)

### 1) STT output (server internal)

```json
{
  "type": "stt.segment",
  "room_id": "room_123",
  "track_id": "spk_audio_1",
  "speaker_id": "spk_001",
  "segment_id": "seg_000981",
  "start_ms": 128340,
  "end_ms": 130920,
  "is_final": true,
  "confidence": 0.91,
  "source_lang": "tr-TR",
  "text": "Tamam, şimdi kapıyı açıyorum."
}
```

### 2) Translation output (server internal → fanout)

```json
{
  "type": "translation.segment",
  "room_id": "room_123",
  "segment_id": "seg_000981",
  "speaker_id": "spk_001",
  "start_ms": 128340,
  "end_ms": 130920,
  "source_lang": "tr-TR",
  "target_lang": "en-US",
  "text": "Okay, I’m opening the door now.",
  "is_final": true
}
```

### 3) Caption event to listener (UI channel)

```json
{
  "type": "captions.update",
  "room_id": "room_123",
  "listener_id": "usr_777",
  "target_lang": "en-US",
  "items": [
    {
      "segment_id": "seg_000981",
      "speaker_id": "spk_001",
      "start_ms": 128340,
      "end_ms": 130920,
      "text": "Okay, I’m opening the door now.",
      "is_final": true
    }
  ]
}
```

### 4) Gemini Live “read-aloud” request (server → Gemini Live)

Session init (style + target voice behavior):

```json
{
  "type": "gemini.session.configure",
  "session_id": "gla_usr_777_en",
  "target_lang": "en-US",
  "read_aloud_policy": {
    "goal": "Speak the translation naturally, matching the speaker's pacing and intensity without adding content.",
    "prosody": {
      "pace": "match_speaker",
      "tone": "match_speaker",
      "pauses": "natural"
    }
  }
}
```

Per translated segment (text-in → audio-out):

```json
{
  "type": "gemini.readaloud.enqueue",
  "session_id": "gla_usr_777_en",
  "segment_id": "seg_000981",
  "start_ms": 128340,
  "end_ms": 130920,
  "text": "Okay, I’m opening the door now."
}
```

### 5) Gemini Live audio response (Gemini → server → listener)

```json
{
  "type": "gemini.audio.chunk",
  "session_id": "gla_usr_777_en",
  "segment_id": "seg_000981",
  "codec": "pcm16",
  "sample_rate_hz": 24000,
  "seq": 42,
  "audio_b64": "BASE64_ENCODED_AUDIO_BYTES"
}
```

## Timing + mixing policy

- Captions latency target: ~300–1200ms behind speech (depending on partial/final handling).
- Read-aloud latency target: ~1–3s behind speech (needs stabilized translated text).

Mixing:
- Option A: original audio + translated read‑aloud ducked to ~20–40% volume.
- Option B: translated only.

## Mapping to this repo (current implementation notes)

Orbit Conference uses Stream Video as the SFU layer. For UI transport, Stream `call.sendCustomEvent(...)` can carry caption/transcript messages to all participants.

Current in-app implementation is intentionally minimal:
- Captions broadcast supports browser SpeechRecognition or **Deepgram Live** (`@deepgram/sdk`) and sends `stt.segment` as Stream custom events.
- Translation is per listener via `POST /api/translator/translate` (Gemini-ready, falls back to passthrough if `GEMINI_API_KEY` is not set).
- Read‑aloud is local `speechSynthesis` (placeholder for Gemini Live audio).

The production architecture above can replace the browser STT and local TTS without changing the client message contracts.
