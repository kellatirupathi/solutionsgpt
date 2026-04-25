const REALTIME_BASE_URL = 'https://api.openai.com/v1/realtime'
const DATA_CHANNEL_OPEN_TIMEOUT_MS = 15000

// semantic_vad uses a small model on the server side to decide when the user
// has finished a thought, not just hit a pause. This handles natural thinking
// pauses much better than threshold-based VAD and stops the assistant from
// barging in mid-sentence. eagerness: 'low' = wait longer before assuming the
// user is done, which is what we want for a discovery conversation.
const DEFAULT_TURN_DETECTION = {
  type: 'semantic_vad',
  eagerness: 'medium',
  create_response: true,
  interrupt_response: false,
}

// Server-side noise reduction for cleaner transcription. near_field suits a
// person speaking into a laptop/phone mic; far_field is for room mics.
const DEFAULT_NOISE_REDUCTION = { type: 'near_field' }

// Browser-side audio constraints — these run before the audio reaches OpenAI
// and remove most ambient hum, AC noise, and echo from speakers.
const AUDIO_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
    sampleRate: 24000,
  },
}

export class RealtimeVoiceSession {
  constructor({
    apiKey,
    model,
    voice,
    instructions,
    priorMessages,
    onUserTranscript,
    onAssistantDelta,
    onAssistantDone,
    onStateChange,
    onError,
  }) {
    this.apiKey = apiKey
    this.model = model
    this.voice = voice
    this.instructions = instructions
    this.priorMessages = priorMessages || []
    this.onUserTranscript = onUserTranscript
    this.onAssistantDelta = onAssistantDelta
    this.onAssistantDone = onAssistantDone
    this.onStateChange = onStateChange
    this.onError = onError

    this.pc = null
    this.dc = null
    this.audioEl = null
    this.localStream = null
    this.localAudioCtx = null
    this.localAnalyser = null
    this.remoteAudioCtx = null
    this.remoteAnalyser = null
    this.activeAssistantResponseId = null
    this.assistantTranscriptBuffer = ''
    this.stopped = false
    this.dataChannelOpened = false
    this.connectionTimeoutId = null
  }

  async start() {
    this.stopped = false
    this.onStateChange?.('connecting')

    const audioEl = document.createElement('audio')
    audioEl.autoplay = true
    audioEl.playsInline = true

    const pc = new RTCPeerConnection()
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0]
      if (this.audioEl) {
        this.audioEl.srcObject = remoteStream
      }
      this.attachRemoteAnalyser(remoteStream)
    }

    pc.addEventListener('iceconnectionstatechange', () => {
      const state = pc.iceConnectionState
      console.debug('[realtime] iceConnectionState:', state)
      if (state === 'failed' || state === 'disconnected') {
        if (!this.dataChannelOpened && !this.stopped) {
          this.handleConnectionFailure(
            new Error(`WebRTC ICE connection ${state}. Check network/firewall and OpenAI Realtime API access.`),
          )
        }
      }
    })

    pc.addEventListener('connectionstatechange', () => {
      const state = pc.connectionState
      console.debug('[realtime] connectionState:', state)
      if (state === 'failed') {
        if (!this.dataChannelOpened && !this.stopped) {
          this.handleConnectionFailure(
            new Error('WebRTC peer connection failed. The Realtime API likely rejected the session — check your model name and API key access.'),
          )
        }
      }
    })

    const dc = pc.createDataChannel('oai-events')
    dc.addEventListener('open', () => {
      this.dataChannelOpened = true
      this.clearConnectionTimeout()
      this.handleDataChannelOpen()
    })
    dc.addEventListener('error', (event) => {
      console.error('[realtime] data channel error:', event)
      if (!this.dataChannelOpened && !this.stopped) {
        this.handleConnectionFailure(new Error('Realtime data channel error.'))
      }
    })
    dc.addEventListener('message', (event) => {
      try {
        const parsed = JSON.parse(event.data)
        this.handleEvent(parsed)
      } catch {
        // Ignore non-JSON messages
      }
    })

    this.audioEl = audioEl
    this.pc = pc
    this.dc = dc

    let localStream = null

    try {
      localStream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS)

      if (this.stopped || pc.signalingState === 'closed') {
        localStream.getTracks().forEach((track) => track.stop())
        return
      }

      this.localStream = localStream
      const audioTrack = localStream.getAudioTracks()[0]
      pc.addTrack(audioTrack, localStream)
      this.attachLocalAnalyser(localStream)

      const offer = await pc.createOffer()
      if (this.stopped || pc.signalingState === 'closed') return
      await pc.setLocalDescription(offer)
      if (this.stopped || pc.signalingState === 'closed') return

      const response = await fetch(
        `${REALTIME_BASE_URL}?model=${encodeURIComponent(this.model)}`,
        {
          method: 'POST',
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/sdp',
          },
        },
      )

      if (this.stopped || pc.signalingState === 'closed') return

      if (!response.ok) {
        const errorText = await response.text()
        const detailed = parseRealtimeError(errorText)
        const statusHint =
          response.status === 401
            ? ' (401 Unauthorized — check VITE_OPENAI_API_KEY)'
            : response.status === 403
              ? ' (403 Forbidden — your API key likely lacks Realtime API access)'
              : response.status === 404
                ? ` (404 — model "${this.model}" not found. Try VITE_OPENAI_REALTIME_MODEL=gpt-realtime)`
                : ` (HTTP ${response.status})`
        throw new Error(`${detailed}${statusHint}`)
      }

      const answerSdp = await response.text()
      if (this.stopped || pc.signalingState === 'closed') return
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })

      this.connectionTimeoutId = window.setTimeout(() => {
        if (!this.dataChannelOpened && !this.stopped) {
          console.error('[realtime] data channel did not open within timeout', {
            iceConnectionState: pc.iceConnectionState,
            connectionState: pc.connectionState,
            signalingState: pc.signalingState,
          })
          this.handleConnectionFailure(
            new Error(
              `Voice mode timed out. ICE state: ${pc.iceConnectionState}, peer state: ${pc.connectionState}. The Realtime model may be unavailable on your API key, or a firewall is blocking WebRTC. Try switching VITE_OPENAI_REALTIME_MODEL or check OpenAI Realtime API access.`,
            ),
          )
        }
      }, DATA_CHANNEL_OPEN_TIMEOUT_MS)
    } catch (error) {
      if (this.stopped) {
        return
      }
      try {
        localStream?.getTracks().forEach((track) => track.stop())
      } catch {
        // ignore
      }
      this.onError?.(error)
      this.stop()
    }
  }

  handleDataChannelOpen() {
    this.send({
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: this.instructions,
        voice: this.voice,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: { model: 'whisper-1', language: 'en' },
        input_audio_noise_reduction: DEFAULT_NOISE_REDUCTION,
        turn_detection: DEFAULT_TURN_DETECTION,
      },
    })

    for (const message of this.priorMessages) {
      if (!message?.content?.trim()) {
        continue
      }

      const role = message.role === 'assistant' ? 'assistant' : 'user'
      const contentType = role === 'assistant' ? 'text' : 'input_text'

      this.send({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role,
          content: [{ type: contentType, text: message.content }],
        },
      })
    }

    this.onStateChange?.('listening')
  }

  handleEvent(event) {
    switch (event.type) {
      case 'input_audio_buffer.speech_started':
        // Only switch to user_speaking when no assistant response is in flight.
        // If the mic picks up speaker echo while the assistant is talking, we
        // skip the state flip so the UI doesn't flash "Listening…" mid-speech.
        if (!this.activeAssistantResponseId) {
          this.onStateChange?.('user_speaking')
        }
        break

      case 'input_audio_buffer.speech_stopped':
        if (!this.activeAssistantResponseId) {
          this.onStateChange?.('thinking')
        }
        break

      case 'conversation.item.input_audio_transcription.completed': {
        const transcript = (event.transcript || '').trim()
        if (transcript) {
          this.onUserTranscript?.(transcript)
        }
        break
      }

      case 'response.created':
        this.activeAssistantResponseId = event.response?.id || null
        this.assistantTranscriptBuffer = ''
        this.onStateChange?.('speaking')
        break

      case 'response.audio_transcript.delta': {
        const delta = event.delta || ''
        if (delta) {
          this.assistantTranscriptBuffer += delta
          this.onAssistantDelta?.(delta, this.assistantTranscriptBuffer)
        }
        break
      }

      case 'response.audio_transcript.done': {
        const finalText = event.transcript || this.assistantTranscriptBuffer
        if (finalText) {
          this.onAssistantDone?.(finalText)
        }
        this.assistantTranscriptBuffer = ''
        break
      }

      case 'response.done':
        this.activeAssistantResponseId = null
        if (!this.stopped) {
          this.onStateChange?.('listening')
        }
        break

      case 'error':
        this.onError?.(new Error(event.error?.message || 'Realtime error'))
        break

      default:
        break
    }
  }

  send(payload) {
    if (this.dc?.readyState === 'open') {
      this.dc.send(JSON.stringify(payload))
    }
  }

  handleConnectionFailure(error) {
    if (this.stopped) return
    this.clearConnectionTimeout()
    this.onError?.(error)
    this.stop()
  }

  clearConnectionTimeout() {
    if (this.connectionTimeoutId !== null) {
      window.clearTimeout(this.connectionTimeoutId)
      this.connectionTimeoutId = null
    }
  }

  interrupt() {
    if (this.activeAssistantResponseId) {
      this.send({ type: 'response.cancel' })
    }
  }

  setMuted(muted) {
    if (!this.localStream) return
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !muted
    })
  }

  attachLocalAnalyser(stream) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) return
      this.localAudioCtx = new AudioCtx()
      const source = this.localAudioCtx.createMediaStreamSource(stream)
      this.localAnalyser = this.localAudioCtx.createAnalyser()
      this.localAnalyser.fftSize = 256
      source.connect(this.localAnalyser)
    } catch {
      // Analyser is decorative; ignore failures
    }
  }

  attachRemoteAnalyser(stream) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) return
      this.remoteAudioCtx = new AudioCtx()
      const source = this.remoteAudioCtx.createMediaStreamSource(stream)
      this.remoteAnalyser = this.remoteAudioCtx.createAnalyser()
      this.remoteAnalyser.fftSize = 256
      source.connect(this.remoteAnalyser)
    } catch {
      // Analyser is decorative; ignore failures
    }
  }

  getInputLevel() {
    return readAnalyserLevel(this.localAnalyser)
  }

  getOutputLevel() {
    return readAnalyserLevel(this.remoteAnalyser)
  }

  stop() {
    this.stopped = true
    this.clearConnectionTimeout()

    try {
      this.localStream?.getTracks().forEach((track) => track.stop())
    } catch {
      // ignore
    }

    try {
      this.dc?.close()
    } catch {
      // ignore
    }

    try {
      this.pc?.getSenders()?.forEach((sender) => {
        try {
          sender.track?.stop()
        } catch {
          // ignore
        }
      })
      this.pc?.close()
    } catch {
      // ignore
    }

    try {
      this.localAudioCtx?.close()
    } catch {
      // ignore
    }

    try {
      this.remoteAudioCtx?.close()
    } catch {
      // ignore
    }

    if (this.audioEl) {
      try {
        this.audioEl.srcObject = null
        this.audioEl.remove()
      } catch {
        // ignore
      }
    }

    this.pc = null
    this.dc = null
    this.audioEl = null
    this.localStream = null
    this.localAudioCtx = null
    this.localAnalyser = null
    this.remoteAudioCtx = null
    this.remoteAnalyser = null
    this.activeAssistantResponseId = null
    this.onStateChange?.('idle')
  }
}

function readAnalyserLevel(analyser) {
  if (!analyser) return 0
  const data = new Uint8Array(analyser.frequencyBinCount)
  analyser.getByteFrequencyData(data)
  let sum = 0
  for (let index = 0; index < data.length; index += 1) {
    sum += data[index]
  }
  return sum / data.length / 255
}

function parseRealtimeError(text) {
  if (!text) {
    return 'Realtime connection failed.'
  }
  try {
    const parsed = JSON.parse(text)
    return parsed?.error?.message || text
  } catch {
    return text
  }
}
