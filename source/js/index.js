var $ = require('jquery');
var SimpleWebRTC = require('./SimpleWebRTC');
var Editor = require('./editor');
var questions = require('./questions');

function init() {
  // Current number of videos displayed, including our own
  var videoCount = 1;

  var currentQuestion = null;
  var currentQuestionIndex = 0;

  // Grab the room from the URL
  var room = location.hash.slice(1);

  var els = {
    videoPanel: '#cc-VideoPanel',
    local: '#cc-LocalVideo',
    languageSelect: '#cc-Language',
    editor: '#cc-EditorComponent'
  };

  // Create our webrtc connection
  var webrtc = new SimpleWebRTC({
    localVideoEl: els.local,
    remoteVideosEl: '',
    autoRequestMedia: true,  // immediately ask for camera access
    debug: false,
    detectSpeakingEvents: true,
    autoAdjustMic: false
  });

  // Create the editor
  var editor = Editor(webrtc);

  // Make element references
  for (var el in els) {
    els['$'+el] = $(els[el]);
    els[el] = els['$'+el][0];
  }

  // Start the interview
  showQuestion(0, true);

  // When it's ready, join if we got a room from the URL
  webrtc.on('readyToCall', function() {
    // You can name it anything
    if (room) {
      webrtc.joinRoom(room);
    }
  });

  webrtc.on('channelOpen', function(channel) {
    console.log('%s opened!', channel.label);

    if (channel.label === 'simplewebrtc') {
      if (currentQuestionIndex !== 0) {
        // Send current question to peer if we're not on the first one
        broadcastQuestion();
      }
    }
  });

  webrtc.on('channelClose', function(channel) {
    console.warn('%s closed!', channel.label);
  });

  webrtc.on('channelError', function(label, error) {
    console.error('Error on %s: %s', label, error);
  });

  /*
    Collaborator has joined
  */
  webrtc.on('videoAdded', function(video, peer) {
    console.log('Collaborator joined!');

    // Update video count
    setVideoCount(+1);

    // Add video element
    if (els.videoPanel) {
      var d = document.createElement('div');
      d.className = 'cc-Video cc-Video--canEnlarge';
      d.id = 'container_' + webrtc.getDomId(peer);
      d.appendChild(video);
      var vol = document.createElement('div');
      vol.id = 'volume_' + peer.id;
      vol.className = 'cc-Video-speaking cc-Icon icon-speaker-active';

      // Click to enlarge video
      var fullSize = false;
      video.onclick = function() {
        d.classList[fullSize ? 'remove' : 'add']('cc-Video--fullSize');
        fullSize = !fullSize;
      };

      d.appendChild(vol);
      els.videoPanel.appendChild(d);
    }
  });

  /*
    Collaborator has left
  */
  webrtc.on('videoRemoved', function(video, peer) {
    console.log('Collaborator left!');

    // Update video count
    setVideoCount(-1);

    // Remove video element
    var el = document.getElementById('container_' + webrtc.getDomId(peer));
    if (els.videoPanel && el) {
      els.videoPanel.removeChild(el);
    }
  });

  /*
    Volume updates from connected clients
  */
  webrtc.on('channelMessage', function(peer, label, data) {
    if (label === 'simplewebrtc') {
      // Handle events from hark
      if (data.type === 'speaking') {
        showSpeaking(document.getElementById('volume_' + peer.id));
      }
      else if (data.type === 'stoppedSpeaking') {
        hideSpeaking(document.getElementById('volume_' + peer.id));
      }
      else if (data.type === 'changeQuestion') {
        showQuestion(data.payload.questionIndex, true);
      }
    }
  });

  $(document.body).on('click', '.js-previousQuestion', function() {
    if (currentQuestionIndex > 0) {
      showQuestion(--currentQuestionIndex);
    }
  });

  $(document.body).on('click', '.js-nextQuestion', function() {
    if (currentQuestionIndex < questions.length - 1) {
      showQuestion(++currentQuestionIndex);
    }
  });

  $(document.body).on('click', '.js-saveBookmark', function() {
    console.log('Would save bookmark');
  });

  // Handle create room form
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

  // @todo change to setTitle, separate room creation into a different method
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

  function showSpeaking(el, volume) {
    if (!el) return;
    el.style.display = '';
  }

  function hideSpeaking(el, volume) {
    if (!el) return;
    el.style.display = 'none';
  }

  function setVideoCount(change) {
    videoCount += change;

    els.videoPanel.className = els.videoPanel.className.replace(/cc-VideoPanel--\d+/g, '');
    els.videoPanel.classList.add('cc-VideoPanel--'+videoCount);
  }

  function showVideo() {
    els.$videoPanel.show();
  }

  function hideVideo() {
    els.$videoPanel.hide();
  }

  function showCode(code) {
    els.$editor.show();
    els.$languageSelect.show();
    editor.setValue(code);
  }

  function hideCode() {
    els.$languageSelect.hide();
    els.$editor.hide();
  }

  function broadcastQuestion() {
    webrtc.sendDirectlyToAll('simplewebrtc', 'changeQuestion', { questionIndex: currentQuestionIndex });
  }

  function showQuestion(questionIndex, noTrigger) {
    if (questions[questionIndex]) {
      currentQuestionIndex = questionIndex;
      currentQuestion = questions[questionIndex];

      setRoom(room+': '+currentQuestion.name);

      if (currentQuestion.video) {
        showVideo();
        if (currentQuestion.code) {
          els.videoPanel.classList.add('cc-VideoPanel--small');
        }
        else {
          els.videoPanel.classList.remove('cc-VideoPanel--small');
        }
      }
      else {
        hideVideo();
      }

      if (currentQuestion.code) {
        showCode(currentQuestion.code);
      }
      else {
        hideCode();
      }

      $('.js-previousQuestion').attr('disabled', questionIndex === 0);
      $('.js-nextQuestion').attr('disabled', questionIndex === questions.length - 1);

      if (!noTrigger) {
        broadcastQuestion();
      }
    }
  }
}

// Initialze when ready
$(init);
