import './style.css'
import { socket } from './socket.js';
import { P2PConnection } from './webrtc.js';
import QRCode from 'qrcode';

const landingView = document.getElementById('landing-view');
const roomView = document.getElementById('room-view');
const createBtn = document.getElementById('create-btn');
const joinBtn = document.getElementById('join-btn');
const joinInput = document.getElementById('join-input');
const roomIdDisplay = document.getElementById('room-id-display');
const statusBadge = document.getElementById('status-badge');
const qrcodeCanvas = document.getElementById('qrcode');
const copyBtn = document.getElementById('copy-btn');
const fileInput = document.getElementById('file-input');
const progressArea = document.getElementById('progress-area');
const progressBar = document.getElementById('progress-bar');
const transferStatus = document.getElementById('transfer-status');
const transferPercent = document.getElementById('transfer-percent');
const downloadsArea = document.getElementById('downloads-area');
const leaveBtn = document.getElementById('leave-btn');

let p2pConnection;
let currentRoomId;

// Check URL params for room
const urlParams = new URLSearchParams(window.location.search);
const roomParam = urlParams.get('room');

if (roomParam) {
    joinRoom(roomParam);
}

leaveBtn.addEventListener('click', () => {
    // 1. Disconnect Socket
    if (socket.connected) {
        socket.disconnect();
    }

    // 2. Close WebRTC
    if (p2pConnection) {
        if (p2pConnection.peerConnection) {
            p2pConnection.peerConnection.close();
        }
        if (p2pConnection.dataChannel) {
            p2pConnection.dataChannel.close();
        }
        p2pConnection = null;
    }

    // 3. Reset UI
    currentRoomId = null;
    downloadsArea.innerHTML = ''; // Clear downloads
    progressArea.classList.add('hidden');
    document.getElementById('share-info').classList.remove('hidden'); // Show QR again next time
    joinInput.value = '';

    // 4. Update URL (remove ?room=...)
    const url = new URL(window.location);
    url.searchParams.delete('room');
    window.history.pushState({}, '', url);

    // 5. Switch Views
    roomView.classList.add('hidden');
    landingView.classList.remove('hidden');
});

createBtn.addEventListener('click', () => {
    // crypto.randomUUID() requires HTTPS. Check availability or use fallback.
    const roomId = (typeof crypto.randomUUID === 'function') 
        ? crypto.randomUUID().split('-')[0] 
        : Math.random().toString(36).substring(2, 10);
    joinRoom(roomId);
});

joinBtn.addEventListener('click', () => {
    const roomId = joinInput.value.trim();
    if (roomId) joinRoom(roomId);
});

copyBtn.addEventListener('click', () => {
    const url = `${window.location.origin}/?room=${currentRoomId}`;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
            copyBtn.innerText = 'Copied!';
            setTimeout(() => copyBtn.innerText = 'Copy Link', 2000);
        }).catch(err => {
             console.error('Async: Could not copy text: ', err);
             fallbackCopyTextToClipboard(url);
        });
    } else {
        fallbackCopyTextToClipboard(url);
    }
});

function fallbackCopyTextToClipboard(text) {
  var textArea = document.createElement("textarea");
  textArea.value = text;
  
  // Avoid scrolling to bottom
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    var successful = document.execCommand('copy');
    if (successful) {
        copyBtn.innerText = 'Copied!';
        setTimeout(() => copyBtn.innerText = 'Copy Link', 2000);
    } else {
        copyBtn.innerText = 'Manual Copy Needed';
    }
  } catch (err) {
    console.error('Fallback: Oops, unable to copy', err);
    copyBtn.innerText = 'Manual Copy Needed';
  }

  document.body.removeChild(textArea);
}

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (p2pConnection) {
        progressArea.classList.remove('hidden');
        await p2pConnection.sendFile(file);
    }
});

function joinRoom(roomId) {
    currentRoomId = roomId;
    landingView.classList.add('hidden');
    roomView.classList.remove('hidden');
    roomIdDisplay.innerText = roomId;

    // Generate QR
    const url = `${window.location.origin}/?room=${roomId}`;
    QRCode.toCanvas(qrcodeCanvas, url, { width: 150, margin: 2, color: { dark: '#10B981', light: '#1F2937' } });

    // Connect to signaling
    socket.connect();
    socket.emit('join-room', { roomId });

    // Init P2P
    p2pConnection = new P2PConnection(
        roomId, 
        handleStatusChange,
        handleProgress,
        handleFileReceived
    );
}

function handleStatusChange(state) {
    let color = 'text-yellow-500';
    let bg = 'bg-yellow-500/20';
    let text = 'Waiting';

    if (state === 'connected') {
        color = 'text-emerald-500';
        bg = 'bg-emerald-500/20';
        text = 'Connected';
        // Hide QR code/Invite info when connected to focus on sharing
        document.getElementById('share-info').classList.add('hidden');
    } else if (state === 'disconnected' || state === 'failed') {
        color = 'text-red-500';
        bg = 'bg-red-500/20';
        text = 'Disconnected';
    }

    statusBadge.className = `px-3 py-1 ${bg} ${color} text-xs rounded-full uppercase tracking-wider font-bold`;
    statusBadge.innerText = text;
}

function handleProgress(percent, type) {
    progressArea.classList.remove('hidden');
    progressBar.style.width = `${percent}%`;
    transferPercent.innerText = `${Math.round(percent)}%`;
    transferStatus.innerText = type === 'sending' ? 'Sending...' : 'Receiving...';
    
    if (percent >= 100) {
        setTimeout(() => {
            progressArea.classList.add('hidden');
            progressBar.style.width = '0%';
        }, 3000);
    }
}

function handleFileReceived(blob, name) {
    const url = URL.createObjectURL(blob);
    const div = document.createElement('div');
    div.className = "flex items-center justify-between p-3 bg-gray-800 rounded-xl border border-gray-700";
    div.innerHTML = `
        <div class="flex items-center gap-3 overflow-hidden">
            <svg class="w-6 h-6 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            <span class="truncate text-sm font-medium">${name}</span>
        </div>
        <a href="${url}" download="${name}" class="text-blue-400 hover:text-blue-300 text-sm font-bold">Download</a>
    `;
    downloadsArea.appendChild(div);
}
