import React, { useState, useRef, useEffect } from 'react'
import { createSender, createReceiver } from './webrtc'
import QRCode from 'qrcode'

const SIGNAL_SERVER = import.meta.env.VITE_SIGNALING_URL || 'ws://localhost:8080'
const CHUNK_SIZE = 64 * 1024

function genRoomCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function asset(name) {
  // serve images from repository path; encode for URL
  return encodeURI(`/X X - DOC MDS/${name}`)
}

export default function App() {
  const [files, setFiles] = useState([])
  const [sendProgress, setSendProgress] = useState([]) // {name,size,sent,percent,speed,eta,status}
  const [recvProgress, setRecvProgress] = useState([])
  const [totalSize, setTotalSize] = useState(0)
  const [mode, setMode] = useState('home') // 'home' | 'lobby' | 'transfer'
  const [hostName, setHostName] = useState('You')
  const [participants, setParticipants] = useState([]) // [{name,role,id}]
  const [room, setRoom] = useState('')
  const [status, setStatus] = useState('idle')
  const wsRef = useRef(null)
  const pcRef = useRef(null)
  const dcRef = useRef(null)
  const incomingRef = useRef({})

  useEffect(() => { setTotalSize(files.reduce((s,f)=>s+f.size,0)) }, [files])

  function onDrop(e) {
    e.preventDefault()
    const list = Array.from(e.dataTransfer.files)
    setFiles(prev => [...prev, ...list])
  }

  function removeFile(idx) { setFiles(f=>f.filter((_,i)=>i!==idx)) }

  async function startSender() {
    if (!files.length) return alert('Add files first')
    // initialize send progress entries
    setSendProgress(files.map(f=>({ name: f.name, size: f.size, sent: 0, percent: 0, speed: 0, eta: null, status: 'pending' })))
    const roomCode = genRoomCode()
    setRoom(roomCode)
    wsRef.current = new WebSocket(SIGNAL_SERVER)
    wsRef.current.onopen = () => {
      wsRef.current.send(JSON.stringify({ type: 'create', room: roomCode }))
      // initialize participants for a local-created room
      setParticipants([{ name: hostName || 'Host', role: 'host', id: 0 }])
      setMode('room')
    }
    wsRef.current.onmessage = async (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.type === 'created') setStatus('waiting')
      if (msg.type === 'peer-joined') {
        setStatus('connecting')
        // a peer joined the room; add a USER entry if below cap
        setParticipants(prev=>{
          const users = prev.filter(p=>p.role!=='user')
          const userCount = prev.filter(p=>p.role==='user').length
          if (userCount >= 99) return prev
          return [...users, ...Array.from({length:userCount}, (_,i)=>({name:`USER${i+1}`,role:'user',id:i+1})), { name: `USER${userCount+1}`, role: 'user', id: userCount+1 }]
        })
        const { pc, dc } = createSender()
        pcRef.current = pc
        dcRef.current = dc
        dc.onopen = () => {
          setStatus('connected')
          sendFilesOverDataChannel(dc, files)
        }
        pc.onicecandidate = (e) => { if (e.candidate) wsRef.current.send(JSON.stringify({ type: 'signal', room: roomCode, payload: { candidate: e.candidate } })) }
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        wsRef.current.send(JSON.stringify({ type: 'signal', room: roomCode, payload: { sdp: pc.localDescription } }))
        // generate shareable link and QR
        try {
          const link = `${window.location.origin}?room=${roomCode}`
          setShareLink(link)
          const dataUrl = await QRCode.toDataURL(link)
          setQrDataUrl(dataUrl)
        } catch (e) { }
      }
      if (msg.type === 'signal') {
        const payload = msg.payload
        if (payload.sdp) {
          await pcRef.current.setRemoteDescription(payload.sdp)
        }
        if (payload.candidate) {
          try { await pcRef.current.addIceCandidate(payload.candidate) } catch (e) { }
        }
      }
      if (msg.type === 'peer-left') setStatus('peer-left')
    }
  }

  // Create a room on the server via POST /rooms and enter lobby
  async function createRoomServer() {
    try {
      const res = await fetch('/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      const body = await res.json()
      if (body && body.room) {
        setRoom(body.room)
        // claim room via WebSocket create once connected (sender will call create)
        setMode('lobby')
        // set initial participants with host
        setParticipants([{ name: hostName || 'Host', role: 'host', id: 0 }])
        // generate shareable link and QR for lobby
        try {
          const link = `${window.location.origin}?room=${body.room}`
          setShareLink(link)
          const dataUrl = await QRCode.toDataURL(link)
          setQrDataUrl(dataUrl)
        } catch (e) { }
      }
    } catch (e) {
      console.error('createRoomServer error', e)
      alert('Failed to create room on server')
    }
  }

  async function startReceiver(code) {
    setRoom(code)
    wsRef.current = new WebSocket(SIGNAL_SERVER)
    wsRef.current.onopen = () => { wsRef.current.send(JSON.stringify({ type: 'join', room: code })) }
    wsRef.current.onmessage = async (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.type === 'joined') setStatus('joined')
      if (msg.type === 'joined') {
        // when joining, show room UI and list host + this user
        setParticipants([{ name: 'Host', role: 'host', id: 0 }, { name: 'USER1', role: 'user', id: 1 }])
        setMode('room')
      }
      if (msg.type === 'signal') {
        const payload = msg.payload
        if (payload.sdp) {
          // receiver: when offer arrives, create pc and set remote, make answer
          if (!pcRef.current) {
            const { pc, getChannel } = createReceiver()
            pcRef.current = pc
            pc.onicecandidate = (e) => { if (e.candidate) wsRef.current.send(JSON.stringify({ type: 'signal', room: code, payload: { candidate: e.candidate } })) }
            pc.ondatachannel = (e) => {
              const ch = e.channel
              ch.binaryType = 'arraybuffer'
              setupReceiverChannel(ch)
            }
          }
          await pcRef.current.setRemoteDescription(payload.sdp)
          if (payload.sdp.type === 'offer') {
            const answer = await pcRef.current.createAnswer()
            await pcRef.current.setLocalDescription(answer)
            wsRef.current.send(JSON.stringify({ type: 'signal', room: code, payload: { sdp: pcRef.current.localDescription } }))
          }
        }
        if (payload.candidate) {
          try { await pcRef.current.addIceCandidate(payload.candidate) } catch (e) { }
        }
      }
      if (msg.type === 'peer-left') setStatus('peer-left')
    }
  }

  useEffect(() => {
    // auto-join if ?room= is in URL
    try {
      const params = new URLSearchParams(window.location.search)
      const urlRoom = params.get('room')
      if (urlRoom) {
        setRoom(urlRoom)
        // automatically attempt to join when URL contains room
        setTimeout(()=>{
          if (urlRoom) startReceiver(urlRoom)
        }, 300)
      }
    } catch (e) { }
  }, [])

  const [shareLink, setShareLink] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')

  function setupReceiverChannel(ch) {
    let meta = null
    const buffers = []
    let receivedBytes = 0
    let lastTime = Date.now()
    let lastBytes = 0
    ch.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        const obj = JSON.parse(ev.data)
        if (obj.type === 'meta') { meta = obj; receivedBytes = 0; buffers.length = 0 }
        if (obj.type === 'done') {
          const blob = new Blob(buffers)
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = meta.name
          a.click()
          // mark receiver progress complete
          setRecvProgress(prev=>{
            return prev.map(p=> p.name===meta.name ? { ...p, sent: p.size, percent: 100, speed: 0, eta: 0, status: 'complete' } : p)
          })
        }
      } else {
        buffers.push(ev.data)
        receivedBytes += ev.data.byteLength
        // update per-file receive progress
        setRecvProgress(prev=>{
          // ensure entry exists
          if (!prev.find(p=>p.name===meta.name)) {
            return [...prev, { name: meta.name, size: meta.size, sent: receivedBytes, percent: Math.floor((receivedBytes/meta.size)*100), speed: 0, eta: null, status: 'receiving' }]
          }
          const now = Date.now()
          const dt = (now - lastTime) / 1000
          const delta = receivedBytes - lastBytes
          const speed = dt>0 ? Math.round(delta / dt) : 0
          lastTime = now; lastBytes = receivedBytes
          return prev.map(p=> p.name===meta.name ? { ...p, sent: receivedBytes, percent: Math.min(100, Math.floor((receivedBytes/meta.size)*100)), speed, eta: speed? Math.round((meta.size-receivedBytes)/speed) : null, status: 'receiving' } : p)
        })
      }
    }
    ch.onopen = () => setStatus('receiving')
  }

  async function sendFilesOverDataChannel(dc, list) {
    for (let idx=0; idx<list.length; idx++) {
      const file = list[idx]
      // update status
      setSendProgress(prev=> prev.map((p,i)=> i===idx ? { ...p, status: 'sending' } : p))
      // send metadata
      dc.send(JSON.stringify({ type: 'meta', name: file.name, size: file.size }))
      const stream = file.stream()
      const reader = stream.getReader()
      let sent = 0
      let lastTime = Date.now()
      let lastSent = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        dc.send(value.buffer ? value.buffer : value)
        sent += (value.byteLength || value.length || 0)
        // throttle if buffer too large
        while (dc.bufferedAmount > 1024 * 1024) await new Promise(r => setTimeout(r, 50))
        // update progress
        const now = Date.now()
        const dt = (now - lastTime) / 1000
        const delta = sent - lastSent
        const speed = dt>0 ? Math.round(delta / dt) : 0
        lastTime = now; lastSent = sent
        setSendProgress(prev=> prev.map((p,i)=> i===idx ? { ...p, sent, percent: Math.min(100, Math.floor((sent/file.size)*100)), speed, eta: speed? Math.round((file.size - sent)/speed) : null } : p))
      }
      dc.send(JSON.stringify({ type: 'done' }))
      setSendProgress(prev=> prev.map((p,i)=> i===idx ? { ...p, sent: file.size, percent: 100, speed: 0, eta: 0, status: 'complete' } : p))
    }
    setStatus('complete')
  }

  return (
    <div className="app" onDragOver={(e)=>e.preventDefault()} onDrop={onDrop}>
      <header className="hero">
        <div className="brand">🌧️🌐 Overcast Journey</div>
        <div className="heroText">
          <h1>Your files, directly to anyone. No servers, no limits.</h1>
          <p>Drop files anywhere on this page to add them.</p>
        </div>
      </header>
      <main>
        {mode === 'home' && (
          <section className="panel">
            <h2>Sender</h2>
          <div className="dropzone">{files.length ? files.map((f,i)=>(
            <div key={i} className="file">
              <div className="fileMeta">
                <div className="fileName">{f.name}</div>
                <div className="fileSize">{(f.size/1024).toFixed(1)} KB</div>
              </div>
              <button className="removeBtn" onClick={()=>removeFile(i)} aria-label={`Remove ${f.name}`}>✖</button>
            </div>
          )) : <div className="empty">Drop files here</div>}</div>
          <div className="uploader">
            <input id="fileInput" className="fileInput" type="file" multiple onChange={(e)=>{ const list = Array.from(e.target.files); setFiles(prev=>[...prev,...list]) }} />
            <label htmlFor="fileInput" className="chooseButton">Choose files</label>
            <div className="uploaderNote">or drag & drop files onto the page</div>
          </div>
            <div className="actions">
              <div>Total: {(totalSize/1024).toFixed(1)} KB</div>
              <div className="actionButtons">
                <button onClick={startSender}>Generate Transfer (local)</button>
                <button onClick={createRoomServer} className="secondary">Create Room (Server)</button>
              </div>
            </div>
          {shareLink && (
            <div className="share">
              <label>Shareable link</label>
              <div className="linkRow">
                <input className="shareInput" value={shareLink} readOnly />
                <button onClick={()=>navigator.clipboard.writeText(shareLink)}>Copy</button>
              </div>
              {qrDataUrl && <img src={qrDataUrl} alt="QR code" className="qr" />}
            </div>
          )}
          </section>
        )}

        {mode === 'lobby' && (
          <section className="panel lobby">
            <h2>Lobby — Room {room}</h2>
            <div className="lobbyInner">
              <div className="hostPanel">
                <div className="hostCard">
                  <div className="hostTitle">Host</div>
                  <div className="hostName">{hostName}</div>
                  <div className="hostActions">
                    <button onClick={()=>{ navigator.clipboard.writeText(room) }}>Copy Code</button>
                    {qrDataUrl && <img src={qrDataUrl} alt="QR" className="qr" />}
                  </div>
                  <div className="lobbyNote">Waiting for receiver to join... Status: {status}</div>
                </div>
              </div>
              <div className="filePanel">
                <div className="fileCard">
                  <div className="fileTitle">Files to send</div>
                  <div className="fileList">
                    {files.length? files.map((f,i)=>(
                      <div key={i} className="fileRow">
                        <div className="fname">{f.name}</div>
                        <div className="fmeta">{(f.size/1024).toFixed(1)} KB</div>
                      </div>
                    )) : <div className="empty">No files selected</div>}
                  </div>
                  <div className="lobbyActions">
                    <button onClick={()=>{ setMode('home') }}>Back</button>
                    <button onClick={async ()=>{
                      // Start WS, claim room and begin sender flow
                      // if room was created on server, claim it via ws create
                      if (room) {
                        // start a sender but use the existing room code
                        // reuse startSender flow but ensure it uses the existing room
                        // simplified: create ws and send create with existing room
                        if (!files.length) return alert('Add files first')
                        setSendProgress(files.map(f=>({ name: f.name, size: f.size, sent: 0, percent: 0, speed: 0, eta: null, status: 'pending' })))
                        wsRef.current = new WebSocket(SIGNAL_SERVER)
                        wsRef.current.onopen = () => { wsRef.current.send(JSON.stringify({ type: 'create', room })) }
                        wsRef.current.onmessage = async (ev) => {
                          const msg = JSON.parse(ev.data)
                          if (msg.type === 'peer-joined') {
                            const { pc, dc } = createSender()
                            pcRef.current = pc
                            dcRef.current = dc
                            dc.onopen = () => { setStatus('connected'); sendFilesOverDataChannel(dc, files) }
                            pc.onicecandidate = (e) => { if (e.candidate) wsRef.current.send(JSON.stringify({ type: 'signal', room, payload:{ candidate: e.candidate } })) }
                            const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
                            wsRef.current.send(JSON.stringify({ type: 'signal', room, payload: { sdp: pc.localDescription } }))
                          }
                          if (msg.type === 'signal') {
                            const payload = msg.payload
                            if (payload.sdp) await pcRef.current.setRemoteDescription(payload.sdp)
                            if (payload.candidate) { try { await pcRef.current.addIceCandidate(payload.candidate) } catch(e){} }
                          }
                        }
                      }
                      setMode('transfer')
                    }} style={{marginLeft:8}}>Start Transfer</button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {mode === 'room' && (
          <section className="panel roomView">
            <h2>Room {room}</h2>
            <div className="roomInner">
              <aside className="participants">
                <div className="partTitle">People in room</div>
                <div className="partList">
                  {participants.length? participants.map((p,i)=> (
                    <div key={i} className={`partItem ${p.role==='host'?'host':''}`}>
                      <div className="pname">{p.name}</div>
                      <div className="prole">{p.role==='host'?'Host':p.name.startsWith('USER')?p.name:'User'}</div>
                    </div>
                  )) : <div className="empty">No participants</div>}
                </div>
              </aside>

              <section className="roomFiles">
                <div className="fileGrid">
                  {files.length? files.map((f,i)=> (
                    <div className="fileCardPreview" key={i}>
                      <div className="thumb">
                        {f.type && f.type.startsWith('image/') ? <img src={URL.createObjectURL(f)} alt={f.name} /> : <img src={asset('Incoming File.png')} alt="file"/>}
                      </div>
                      <div className="finfo">
                        <div className="fname">{f.name}</div>
                        <div className="fsize">{(f.size/1024).toFixed(1)} KB</div>
                      </div>
                    </div>
                  )) : <div className="empty">No files selected</div>}
                </div>
              </section>
            </div>
          </section>
        )}

        <section className="panel">
          <h2>Receiver</h2>
          <div className="join">
            <input placeholder="Enter room code" value={room} onChange={e=>setRoom(e.target.value)} />
            <button onClick={()=>startReceiver(room)}>Join</button>
          </div>
          <div className="status">Status: {status}</div>
          {recvProgress.length>0 && (
            <div className="progressList">
              {recvProgress.map((p,i)=>(
                <div key={i} className="fileProgress">
                  <div className="fileRow">
                    <div className="fname">{p.name}</div>
                    <div className="fmeta">{p.percent}% · {p.speed? (p.speed/1024).toFixed(1)+' KB/s' : ''}</div>
                  </div>
                  <div className="bar"><div className="fill" style={{width: p.percent+'%'}}></div></div>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="panel debug">
          <h2>Debug / Visibility</h2>
          <div className="debugRow">
            <div><strong>WebSocket state:</strong> {wsRef.current ? (wsRef.current.readyState === 1 ? 'OPEN' : wsRef.current.readyState) : 'closed'}</div>
            <div><strong>PeerConnection ICE:</strong> {pcRef.current ? (pcRef.current.iceConnectionState || 'new') : 'none'}</div>
            <div><strong>DataChannel:</strong> {dcRef.current ? (dcRef.current.readyState || 'unknown') : 'none'}</div>
          </div>
          <div className="functionsList">
            <div><strong>Available functions</strong></div>
            <ul>
              <li>createSender: {createSender ? 'yes' : 'no'}</li>
              <li>createReceiver: {createReceiver ? 'yes' : 'no'}</li>
              <li>sendFilesOverDataChannel: yes</li>
              <li>setupReceiverChannel: yes</li>
              <li>startSender / startReceiver: yes</li>
            </ul>
          </div>
        </section>
      </main>
      <footer>OvercastJourney — demo P2P transfer (focus: connectivity)</footer>
    </div>
  )
}
