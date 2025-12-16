import { socket } from './socket.js';

const STUN_SERVERS = {
  iceServers: [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
      ],
    },
  ],
};

export class P2PConnection {
  constructor(roomId, onStatusChange, onProgress, onFileReceived) {
    this.roomId = roomId;
    this.peerConnection = new RTCPeerConnection(STUN_SERVERS);
    this.dataChannel = null;
    this.onStatusChange = onStatusChange;
    this.onProgress = onProgress;
    this.onFileReceived = onFileReceived;

    this.receivedBuffers = [];
    this.receivedSize = 0;
    this.incomingFileInfo = null;

    this.setupSocketListeners();
    this.setupPeerListeners();
  }

  setupSocketListeners() {
    socket.on('offer', async ({ offer, sender }) => {
      console.log('Received offer');
      
      // If we already have a connection (e.g. from a third party?), ignore or reset.
      // For simple 1-1, we assume one peer.
      if (this.peerConnection.signalingState !== "stable") {
        // Collision or glare handling could be needed, but simplistic for now.
      }

      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      console.log('Sending answer');
      socket.emit('answer', { answer, roomId: this.roomId });
    });

    socket.on('answer', async ({ answer }) => {
      console.log('Received answer');
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('ice-candidate', async ({ candidate }) => {
      if (candidate) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("Error adding received ice candidate", e);
        }
      }
    });

    socket.on('user-connected', (userId) => {
      console.log('User connected:', userId);
      this.createOffer();
    });
  }

  setupPeerListeners() {
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', { candidate: event.candidate, roomId: this.roomId });
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection.connectionState);
      this.onStatusChange(this.peerConnection.connectionState);
    };

    this.peerConnection.ondatachannel = (event) => {
      this.setupDataChannel(event.channel);
    };
  }

  async createOffer() {
    console.log('Creating offer');
    this.dataChannel = this.peerConnection.createDataChannel("file-transfer");
    this.setupDataChannel(this.dataChannel);

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    socket.emit('offer', { offer, roomId: this.roomId });
  }

  setupDataChannel(channel) {
    this.dataChannel = channel;
    this.dataChannel.onopen = () => console.log("Data channel open");
    this.dataChannel.onclose = () => console.log("Data channel closed");
    
    this.dataChannel.onmessage = (event) => {
      const { data } = event;
      
      // If data is string, it's likely metadata
      if (typeof data === 'string') {
        const msg = JSON.parse(data);
        if (msg.type === 'file-start') {
          this.incomingFileInfo = msg.info;
          this.receivedBuffers = [];
          this.receivedSize = 0;
          console.log(`Receiving file: ${msg.info.name}`);
        } else if (msg.type === 'file-end') {
           this.finalizeFile();
        }
      } else {
        // Binary data (chunk)
        this.receivedBuffers.push(data);
        this.receivedSize += data.byteLength;
        
        if (this.incomingFileInfo) {
           const progress = (this.receivedSize / this.incomingFileInfo.size) * 100;
           this.onProgress(progress, 'receiving');
        }
      }
    };
  }

  finalizeFile() {
    const blob = new Blob(this.receivedBuffers, { type: this.incomingFileInfo.mime });
    this.onFileReceived(blob, this.incomingFileInfo.name);
    this.receivedBuffers = [];
    this.incomingFileInfo = null;
    this.onProgress(100, 'complete');
  }

  async sendFile(file) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      alert("Connection not ready.");
      return;
    }

    // Send metadata
    this.dataChannel.send(JSON.stringify({
      type: 'file-start',
      info: {
        name: file.name,
        size: file.size,
        mime: file.type
      }
    }));

    // Send chunks
    const chunkSize = 16 * 1024; // 16KB
    let offset = 0;
    
    const reader = new FileReader();
    
    const readSlice = (o) => {
      const slice = file.slice(offset, o + chunkSize);
      reader.readAsArrayBuffer(slice);
    };

    reader.onload = (e) => {
      this.dataChannel.send(e.target.result);
      offset += e.target.result.byteLength;
      
      const progress = (offset / file.size) * 100;
      this.onProgress(progress, 'sending');

      if (offset < file.size) {
        readSlice(offset);
      } else {
        this.dataChannel.send(JSON.stringify({ type: 'file-end' }));
        console.log("File sent");
      }
    };

    readSlice(0);
  }
}
