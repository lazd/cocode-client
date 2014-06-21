var $ = require('jquery');
var SimpleWebRTC = require('./SimpleWebRTC');

function init() {
  // Grab the room from the URL
  var room = location.hash.slice(1);
  setRoom(room);

  // Since we use this twice we put it here
  function setRoom(name) {
    if (name) {
      var url = window.location.href;
      $('#cc-CreateRoom').hide();
      $('#cc-RoomName').text(name);
      $('#cc-JoinLink').removeClass('u-hidden').attr('href', url);
    }
    else {
      $('#cc-CreateRoom').show();
      $('#cc-JoinLink').addClass('u-hidden');
    }
  }

  $('#cc-CreateRoom').on('submit', function() {
    var val = $('#cc-CreateRoom-roomName').val().toLowerCase().replace(/\s/g, '-').replace(/[^A-Za-z0-9_\-]/g, '');
    webrtc.createRoom(val, function(err, name) {
      if (!err) {
        window.location.hash = '#'+name;
        setRoom(name);
      }
      else {
        alert('Error creating room: '+err);
      }
    });
    return false;
  });

  // Create our webrtc connection
  var webrtc = new SimpleWebRTC({
    localVideoEl: 'cc-LocalVideo',
    remoteVideosEl: '',
    autoRequestMedia: true,  // immediately ask for camera access
    debug: false,
    detectSpeakingEvents: true,
    autoAdjustMic: false
  });

  // Create the editor
  var editor = require('./editor')(webrtc);

  window.webrtc = webrtc;

  // when it's ready, join if we got a room from the URL
  webrtc.on('readyToCall', function() {
    // you can name it anything
    if (room) {
      webrtc.joinRoom(room);
    }
  });

  function showSpeaking(el, volume) {
    if (!el) return;
    el.classList.add('icon-speaker-active');
  }

  function hideSpeaking(el, volume) {
    if (!el) return;
    el.classList.remove('icon-speaker-active');
  }

  /*
    Collaborator has joined
  */
  webrtc.on('videoAdded', function(video, peer) {
    console.log('Collaborator joined!');

    var remotes = document.getElementById('cc-RemoteVideo');

    if (remotes) {
      var d = document.createElement('div');
      d.className = 'cc-Video cc-Video--canEnlarge';
      d.id = 'container_' + webrtc.getDomId(peer);
      d.appendChild(video);
      var vol = document.createElement('div');
      vol.id = 'volume_' + peer.id;
      vol.className = 'cc-Video-speaking cc-Icon';

      // Click to enlarge video
      var fullSize = false;
      video.onclick = function() {
        d.classList[fullSize ? 'remove' : 'add']('cc-Video--fullSize');
        fullSize = !fullSize;
      };

      d.appendChild(vol);
      remotes.appendChild(d);
    }
  });

  /*
    Collaborator has left
  */
  webrtc.on('videoRemoved', function(video, peer) {
    console.log('Collaborator left!');

    var remotes = document.getElementById('cc-RemoteVideo');
    var el = document.getElementById('container_' + webrtc.getDomId(peer));
    if (remotes && el) {
      remotes.removeChild(el);
    }
  });

  /*
    Volume updates from connected clients
  */
  webrtc.on('channelMessage', function(peer, label, data) {
    if (label === 'hark') {
      // Handle events from hark
      if (data.type === 'speaking') {
        showSpeaking(document.getElementById('volume_' + peer.id));
      }
      else if (data.type === 'stoppedSpeaking') {
        hideSpeaking(document.getElementById('volume_' + peer.id));
      }
    }
  });
}

// Initialze when ready
$(init);
