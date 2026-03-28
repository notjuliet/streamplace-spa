function waitForIceGathering(pc: RTCPeerConnection, timeout: number): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") {
      resolve();
      return;
    }
    const timer = setTimeout(() => resolve(), timeout);
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(timer);
        resolve();
      }
    };
  });
}

export interface WhepConnection {
  pc: RTCPeerConnection;
  stream: MediaStream;
}

export async function connectWhep(handle: string): Promise<WhepConnection> {
  const whepUrl = `https://stream.place/api/playback/${encodeURIComponent(handle)}/webrtc?rendition=source`;

  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    bundlePolicy: "max-bundle",
  });

  const stream = new MediaStream();

  pc.addTransceiver("video", { direction: "recvonly" });
  pc.addTransceiver("audio", { direction: "recvonly" });

  pc.ontrack = (event) => {
    if (event.streams && event.streams[0]) {
      for (const track of event.streams[0].getTracks()) {
        stream.addTrack(track);
      }
    } else {
      stream.addTrack(event.track);
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitForIceGathering(pc, 500);

  const resp = await fetch(whepUrl, {
    method: "POST",
    headers: { "Content-Type": "application/sdp" },
    body: pc.localDescription!.sdp,
  });

  if (!resp.ok) {
    pc.close();
    const errText = await resp.text();
    throw new Error(`WHEP ${resp.status}: ${errText}`);
  }

  const answerSdp = await resp.text();
  await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

  return { pc, stream };
}
