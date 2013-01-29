var RTCPeerConnection = window.PeerConnection || window.webkitPeerConnection00 || window.webkitRTCPeerConnection;
var servers = {
  iceServers: [{ 'url': 'stun:stun.l.google.com:19302' }]
};
var options = {
  optional: [{ RtpDataChannels: true }]
};

var peers = {};
var channels = {};
var files = {};

var socket = io.connect('http://localhost:8000');

var iceCallback = function (event) {
  if (event.candidate) {
    socket.emit('candidate', { 'candidate': event.candidate });
  }
};

socket.on('candidate', function (data) {
  if (data.candidate && peers[data.from]) {
      console.log(data.candidate.candidate);
      peers[data.from].addIceCandidate(new RTCIceCandidate(data.candidate));
  }
});

socket.on('new', function (data) {
  var pc1 = peers[data.from] = new RTCPeerConnection(servers, options);
  pc1.onicecandidate = iceCallback;

  channels[data.from] = pc1.createDataChannel('sendDataChannel', { reliable: false });
  channels[data.from].onmessage = handleMessage;

  pc1.createOffer(function (desc) {
    pc1.setLocalDescription(desc);
    socket.emit('offer', { 'to': data.from, 'desc': desc });
  });
});

socket.on('offer', function (data) {
  var pc2 = peers[data.from] = new RTCPeerConnection(servers, options);
  pc2.onicecandidate = iceCallback;
  pc2.ondatachannel = function (event) {
    channels[data.from] = event.channel;
    channels[data.from].onmessage = handleMessage;
  };

  pc2.setRemoteDescription(new RTCSessionDescription(data.desc));
  pc2.createAnswer(function (desc) {
    pc2.setLocalDescription(desc);
    socket.emit('answer', { 'to': data.from, 'desc': desc });
  });
});

socket.on('answer', function (data) {
  peers[data.from].setRemoteDescription(new RTCSessionDescription(data.desc));
});

socket.on('disconnect', function (data) {
  delete peers[data.from];
});

var handleMessage = function (event) {
  console.log(event);

  var channel = event.target;
  var data = JSON.parse(event.data);

  if (data.op == 'file-request') {
    handleFileRequest(channel, data.hash);
  }
  else if (data.op == 'file-data') {
    console.log(data.hash + ': ' + data.contents);
  }
};

var handleFileRequest = function (channel, hash) {
  var fileContents = files[hash];

  if (fileContents) {
    channel.send(JSON.stringify({
      'op': 'file-data',
      'hash': hash,
      'contents': fileContents
    }));
  }
};
