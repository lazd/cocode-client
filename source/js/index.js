var $ = require('jquery');
var stunturncheck = require('stunturncheck');
var SimpleWebRTC = require('./SimpleWebRTC');
var Editor = require('./editor');
var questions = require('./questions');
var Growl = require('./growl');

var videoRecorderOptions = {
   type: 'video',
   video: {
      width: 320,
      height: 240
   },
   canvas: {
      width: 320,
      height: 240
   }
};

var audioRecorderOptions = {
};

// Browser detection, uhg
var isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;

function init() {
  // Initial start time
  var startTime = Date.now();

  // Current number of videos displayed, including our own
  var videoCount = 1;

  // A log of events
  var log = [];

  // The name of the room
  var room = '';

  // The name of the user
  var ourUser = 'unnamed';

  // The URL for the candidate
  var candidateURL = '';

  // A list of recorded URLs
  var trackURLs = [];

  // Recorders for ourself
  var videoRecorder = null;
  var audioRecorder = null;

  // Whether the keyframe needs to be sent next tick
  var keyframeChangedSinceLastReport = true;
  var currentKeyframe = null;

  // The current question object and index
  var currentQuestion = null;
  var currentQuestionIndex = 0;

  // Whether to show controls at the bottom
  var isInterviewer = false;

  // Elements to cache references to
  var els = {
    videoPanel: '#cc-VideoPanel',
    local: '#cc-LocalVideo',
    languageSelect: '#cc-Language',
    editor: '#cc-EditorComponent',
    runCodeButton: '.js-runCode',
    downloadButton: '#cc-DownloadButton',
    footer: '#cc-Footer',
    footerButtons: '.js-footerButtons',
    downloadButton: '.js-downloadSession'
  };

  // Grab the room and user from the URL
  var search = window.location.search;
  var hash = window.location.hash;
  var resourceDescription = '';
  if (search) {
    resourceDescription = search.slice(1);
  }
  else if (hash) {
    resourceDescription = hash.slice(1);
  }

  var parts = resourceDescription.split('@');
  if (parts[1]) {
    var userParts = parts[0].split(':');

    // Only enable recorders with a special URL
    if (userParts.length === 2 && userParts[1] === 'interviewer') {
      isInterviewer = true;
    }
    ourUser = userParts[0];

    room = parts[1];
  }
  else {
    // Keep default user
    room = parts[0];
  }

  // Default candidate URL
  candidateURL = '?Candidate@'+room;
  if (!isInterviewer) {
    candidateURL = '?'+ourUser+'@'+room;
  }

  // Create our webrtc connection
  var webrtc = new SimpleWebRTC({
    localVideoEl: els.local,
    remoteVideosEl: '',
    autoRequestMedia: true,  // immediately ask for camera access
    debug: false,
    detectSpeakingEvents: true,
    autoAdjustMic: false
  });

  webrtc.ourUser = ourUser;

  // Create the editor
  var editor = Editor(webrtc, track);

  // Make element references
  for (var el in els) {
    els['$'+el] = $(els[el]);
    els[el] = els['$'+el][0];
  }

  if (!room) {
    $('#cc-Underlay').show();
    $('#cc-CreateRoom').show();
  }
  else {
    startSession();
  }

  /**
    Keyframes
  */

  storeKeyframe();
  setInterval(function() {
    if (keyframeChangedSinceLastReport) {
      track('keyframe', currentKeyframe);
      keyframeChangedSinceLastReport = false;
    }
  }, 1000);

  /**
    Communication listeners
  */

  // Local p2p/ice failure
  webrtc.on('iceFailed', function (peer) {
    handleIceFailure('local', peer);
  });

  // Remote p2p/ice failure
  webrtc.on('connectivityError', function (peer) {
    handleIceFailure('remote', peer);
  });

  webrtc.on('turnservers', function (args) {
    // console.log('Got turn servers ', args);
    var iceServers;
    if (webrtc.client) {
        iceServers = webrtc.client.jingle.config.peerConnectionConfig.iceServers;
    }
    else {
        iceServers = webrtc.webrtc.config.peerConnectionConfig.iceServers;
    }
    var pendingChecks = 0;
    var connectivity = {};

    // since chrome doesn't timeout itself for TURN/TCP...
    // https://code.google.com/p/webrtc/issues/detail?id=3249
    var lastResort = window.setTimeout(function () {
        evaluateConnectivity(connectivity, false, true);
    }, 20 * 1000);
    iceServers.forEach(function (server) {
        pendingChecks++;
        stunturncheck(server, function (err, res) {
            pendingChecks--;
            if (!err) {
                if (server.url.indexOf('stun:') === 0) {
                    connectivity.stun = res > 0;
                }
                else if (server.url.indexOf('turn:') === 0) {
                    // TURN and TURN/TCP
                    if (server.url.indexOf('?transport=tcp') != -1) {
                        connectivity.turntcp = res > 0;
                    }
                    else {
                        connectivity.turn = res > 0;
                    }
                }
                else if (server.url.indexOf('turns:') === 0) {
                    // TURN/TLS in M35
                    connectivity.turntls = res > 0;
                }
                evaluateConnectivity(connectivity, pendingChecks === 0);
            }
            if (pendingChecks === 0 && lastResort) {
                window.clearTimeout(lastResort);
                lastResort = 0;
            }
        });
    });
  });
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
      broadcastName();
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
  webrtc.on('localMediaStarted', function(video, stream) {
    console.log('Local video started!');

    setVideoCount(0);

    if (isInterviewer) {
      if (isFirefox) {
        videoRecorder = RecordRTC(stream, videoRecorderOptions);
        videoRecorder.part = 0;
        videoRecorder.startRecording();
        track('video.started', {
          user: ourUser,
          part: ++videoRecorder.part
        });
      }
      else {
        // Separate streams for Chrome
        /*
        // Technique from: https://github.com/muaz-khan/WebRTC-Experiment/tree/master/RecordRTC#how-to-fix-audiovideo-sync-issues-on-chrome
        // Causing a delay where video lags
        audioRecorder = RecordRTC(stream, {
          onAudioProcessStarted: function( ) {
            videoRecorder.startRecording();
            track('video.started', {
              user: ourUser,
              part: ++videoRecorder.part
            });
          }
        });
        audioRecorder.part = 0;

        videoRecorder = RecordRTC(stream, videoRecorderOptions);
        videoRecorder.part = 0;

        audioRecorder.startRecording();
        track('audio.started', {
          user: ourUser,
          part: ++audioRecorder.part
        });
        */

        // Start at the same time
        // No delay, Chrome 35 on Mac OS X
        videoRecorder = RecordRTC(stream, videoRecorderOptions);
        videoRecorder.part = 0;
        videoRecorder.startRecording();
        track('video.started', {
          user: ourUser,
          part: ++videoRecorder.part
        });

        audioRecorder = RecordRTC(stream, audioRecorderOptions);
        audioRecorder.part = 0;
        audioRecorder.startRecording();
        track('audio.started', {
          user: ourUser,
          part: ++audioRecorder.part
        });
      }
    }
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

    track('collaborator.left', { user: peer.user });

    if (peer.audioRecorder) {
      track('audio.stopped', {
        user: peer.user
      });
      peer.audioRecorder.stopRecording(function(url) {
        storeTrack('audio', url, peer.user+'.'+peer.audioRecorder.part);
      });
    }
    if (peer.videoRecorder) {
      track('video.stopped', {
        user: peer.user
      });
      peer.videoRecorder.stopRecording(function(url) {
        storeTrack('video', url, peer.user+'.'+peer.videoRecorder.part);
      });
    }

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
      else if (data.type === 'hello') {
        if (!peer.user) {
          peer.user = data.payload.user;
          console.warn('Got username for '+peer.id+': '+peer.user);

          track('collaborator.joined', { user: peer.user });
          recordPeer(peer);

          if (currentQuestionIndex !== 0) {
            // Send current question to peer if we're not on the first one
            broadcastQuestions(peer);
          }

          broadcastName(peer);

          // Show a growl
          new Growl(peer.user+' has joined.');
        }
      }
      else if (data.type === 'changeLanguage') {
        var language = data.payload;

        setLanguage(language, peer.user);
      }
      else if (data.type === 'changeQuestion') {
        // Use questions from peer
        questions = data.payload.questions;

        // Show same question as peer
        showQuestion(data.payload.questionIndex, true);

        track('showQuestion', {
          user: peer.user,
          question: currentQuestion,
          questionIndex: currentQuestionIndex
        });
      }
    }
  });

  // Save code changes to the question so it shows when revisited
  editor.on('change', function(i, op) {
    // Don't store editor contents in questions that don't have code
    if (currentQuestion.code !== false) {
      currentQuestion.code = editor.getValue();
      setRunButtonStatus();
      storeKeyframe();
    }
  });

  /**
    DOM Listeners
  */
  $(document.body).on('click', '.js-previousQuestion', function() {
    if (currentQuestionIndex > 0) {
      showQuestion(--currentQuestionIndex);

      trackSelfShowQuestion();
    }
  });

  $(document.body).on('click', '.js-nextQuestion', function() {
    if (currentQuestionIndex < questions.length - 1) {
      showQuestion(++currentQuestionIndex);

      trackSelfShowQuestion();
    }
  });

  $(document.body).on('click', '.js-saveBookmark', function() {
    var data = {
      question: currentQuestion,
      questionIndex: currentQuestionIndex,
      user: ourUser
    };

    new Growl('Bookmark saved.');

    track('bookmark', data);
  });

  $(document.body).on('click', '.js-downloadSession', function(event) {
    event.preventDefault();
    startSessionUpload();
  });

  $(document.body).on('click', '.js-runCode', function(event) {
    runCode();
  });

  // Handle language changes
  $('#cc-Language').on('change', function(event) {
    var language = event.currentTarget.value;

    // Send the current language
    webrtc.sendDirectlyToAll('simplewebrtc', 'changeLanguage', language);

    setLanguage(language, ourUser);
  });

  // Don't let people click the link
  $('#cc-JoinLink').on('click', function(event) {
    event.preventDefault();
  });

  // Handle create room form
  $('#cc-CreateRoom').on('submit', function() {
    var interviewerName = $('#cc-CreateRoom-interviewerName').val();
    var candidateName = $('#cc-CreateRoom-candidateName').val();

    // Mark that we're the interviewer
    isInterviewer = true;

    // Store room name and candidate URL
    room = sanitizeRoomName(interviewerName+'-'+candidateName);
    candidateURL = '?'+candidateName+'@'+room;

    webrtc.createRoom(room, function(err, name) {
      if (err) {
        alert('Error creating room: '+err);
      }
      else {
        $('#cc-Underlay').hide();
        $('#cc-CreateRoom').hide();

        window.history.replaceState({}, null, '?'+interviewerName+':interviewer@'+room);
        startSession();
      }
    });
    return false;
  });

  /**
    Methods
  */

  function sanitizeRoomName(name) {
    return name.toLowerCase().replace(/\s/g, '-').replace(/[^A-Za-z0-9_\-]/g, '');
  }

  function startSession() {
    $('#cc-JoinLink').attr('href', candidateURL);

    // Start the interview
    showQuestion(0, true);

    track('sessionStarted');
    track('collaborator.joined', {
      user: ourUser
    });

    // Track initial question so it is shown correctly during replay
    trackSelfShowQuestion();
  }

  function handleIceFailure(source, peer) {
    var cause = 'both';
    if (peer.pc.hadLocalRelayCandidate && peer.pc.hadRemoteRelayCandidate) {
      cause = 'turn'; // blame the turn servers
    }
    else if (peer.pc.hadRemoteRelayCandidate) {
      cause = 'local';
    }
    else if (peer.pc.hadLocalRelayCandidate) {
      cause = 'remote';
    }
    else {
      cause = 'both';
    }

    var iceServers;
    if (webrtc.client) {
      iceServers = webrtc.client.jingle.config.peerConnectionConfig.iceServers;
    }
    else {
      iceServers = webrtc.webrtc.config.peerConnectionConfig.iceServers;
    }

    switch (cause) {
    case 'turn':
      console.error('TURN server failure');
      break;
    case 'local':
      console.error('Local connection failure.');
      break;
    case 'remote':
      console.error('Peer connection failure.');
      break;
    case 'both':
      console.error('Peer and local connection failure.');
      break;
    }
  }

  function evaluateConnectivity(connectivity, isfinal, timeout) {
      console.log('%s connectivity check:', isfinal ? 'Final' : 'Preliminary', connectivity);

      if (timeout) {
          // when the timeout strikes, bad things may have happened. or not.
          // e.g. we may have turn but not TURN/TCP on port 80
          console.log('Connection timeout!');
      }
      else if (isfinal) {
          // we need to show something to the user
          if (!(connectivity.stun || connectivity.turn)) {
              if (connectivity.turntcp) {
                  // we have TURN/TCP... show a quality warning
                console.log('We have TURN/TCP');
              }
              else if (connectivity.turntls) {
                  // we have TURN/TLS... even worse quality?
                  console.log('We have TURN/TLS');
              }
              else {
                  // no connectivity at all
                  console.error('No connectivity.');
                  alert('We were unable to connect to the WebRTC TURN server, so it looks like we\'ll have to do this on Skype.');
              }
          }
      }
      else {
          if (connectivity.stun) {
              // we have stun
              console.log('We have STUN.');
          }
          if (connectivity.turn) {
              // we have turn at least so from our side stuff should work
              console.log('We have TURN from our side.');
          }
      }
  }

  function recordPeer(peer) {
    // Don't have clients record
    if (!isInterviewer) {
      return;
    }

    if (isFirefox) {
      peer.videoRecorder = RecordRTC(peer.stream, videoRecorderOptions);
      peer.videoRecorder.part = 0;
      peer.videoRecorder.startRecording();
      track('video.started', {
        user: peer.user,
        part: ++peer.videoRecorder.part
      });
    }
    else {
      // Separate streams for Chrome
      // Only record video, requiring the interviewer to leave their speakers on and let the interviewees audio come through loudly
      peer.videoRecorder = RecordRTC(peer.stream, videoRecorderOptions);
      peer.videoRecorder.part = 0;
      peer.videoRecorder.startRecording();
      track('video.started', {
        user: peer.user,
        part: ++peer.videoRecorder.part
      });

      /*
      peer.audioRecorder = RecordRTC(peer.stream);
      peer.audioRecorder.startRecording();
      track('audio.started', {
        user: peer.user
      });
      */
    }
  }

  function restartRecordings() {
    // Start peer recording
    webrtc.webrtc.peers.forEach(function(peer) {
      if (peer.audioRecorder) {
        track('audio.started', {
          user: peer.user,
          part: ++peer.audioRecorder.part
        });

        peer.audioRecorder.startRecording();
      }

      if (peer.videoRecorder) {
        track('video.started', {
          user: peer.user,
          part: ++peer.videoRecorder.part
        });

        peer.videoRecorder.startRecording();
      }
    });

    // Start our recording
    if (audioRecorder) {
      track('audio.started', {
        user: ourUser,
        part: ++audioRecorder.part
      });

      audioRecorder.startRecording();
    }

    if (videoRecorder) {
      track('video.started', {
        user: ourUser,
        part: ++videoRecorder.part
      });

      videoRecorder.startRecording();
    }
  }

  function uploadSession(cb) {
    // The number of tracks left to queue
    var toQueue = 0;

    // Whether all the recorders have been stopped
    var allRecordersStopped = false;

    // Hold tracks to upload
    var tracks = [];

    // Build the session JSON
    var session = {
      log: log,
      questions: questions,
      name: room,
      duration: getTime()
    };

    // Add the session JSON to the data instance
    tracks.push({
      type: 'json',
      name: 'interview.'+(++part),
      blob: new Blob(JSON.stringify(session).split(''), { type: 'application/json'})
    });

    // Called when a track is finished recording
    function handleTrackReady(track) {
      tracks.push(track);

      toQueue--;
      if (toQueue === 0 && allRecordersStopped) {
        if (typeof cb === 'function') {
          // Start the upload
          console.log('Tracks ready for upload...');
          doUpload(tracks);
          cb();
        }
      }
    }

    // Iterate over each peer
    webrtc.webrtc.peers.forEach(function(peer) {
      // Queue their audio and video
      if (peer.audioRecorder) {
        track('audio.stopped', {
          user: peer.user
        });

        toQueue++;
        peer.audioRecorder.stopRecording(function(url) {
          // downloadAudio(url, peer.user+'.'+peer.audioRecorder.part);
          handleTrackReady({
            type: 'audio',
            name: peer.user+'.'+peer.audioRecorder.part,
            blob: peer.audioRecorder.getBlob()
          });
        });
      }

      if (peer.videoRecorder) {
        track('video.stopped', {
          user: peer.user
        });

        toQueue++;
        peer.videoRecorder.stopRecording(function(url) {
          // downloadVideo(url, peer.user+'.'+peer.videoRecorder.part);
          handleTrackReady({
            type: 'video',
            name: peer.user+'.'+peer.videoRecorder.part,
            blob: peer.videoRecorder.getBlob()
          });
        });
      }
    });

    // Queue our audio and video
    if (audioRecorder) {
      track('audio.stopped', {
        user: ourUser
      });

      toQueue++;
      audioRecorder.stopRecording(function(url) {
        // downloadAudio(url, ourUser+'.'+audioRecorder.part);
        handleTrackReady({
          type: 'audio',
          name: ourUser+'.'+audioRecorder.part,
          blob: audioRecorder.getBlob()
        });
      });
    }

    if (videoRecorder) {
      track('video.stopped', {
        user: ourUser
      });

      toQueue++;
      videoRecorder.stopRecording(function(url) {
        // downloadVideo(url, ourUser+'.'+videoRecorder.part);
        handleTrackReady({
          type: 'video',
          name: ourUser+'.'+videoRecorder.part,
          blob: videoRecorder.getBlob()
        });
      });
    }

    allRecordersStopped = true;
  }

  function downloadTrack(track) {
    if (track.type === 'audio') {
      downloadAudio(track.url, track.name);
    }
    else if (track.type === 'video') {
      downloadVideo(track.url, track.name);
    }
    else {
      throw new Error('Unsupported media type: '+track.type)
    }
  }

  function sanitizeFilename(id) {
    return id.replace(/[^a-zA-Z0-9]+/g, '');
  }

  function downloadURL(url, fileName) {
    // Check for anchor with download ability
    var downloadAttrSupported = !isFirefox && ('download' in document.createElement('a'));

    if (downloadAttrSupported) {
      var a = document.createElement('a');
      a.download = fileName;
      a.href = url;
      a.target = '_blank';
      a.click();
    }
    else {
      // Open the image in a popup
      window.open(url, fileName);
    }
  }

  function downloadVideo(url, name) {
    id = sanitizeFilename(name);
    downloadURL(url, name+'.video.webm');
  }

  function downloadAudio(url, name) {
    id = sanitizeFilename(name);
    downloadURL(url, name+'.audio.wav');
  }

  var part = 0;
  function startSessionUpload() {
    track('sessionEnded');

    // Upload the recordings
    uploadSession(function() {
      // Reset log and start time
      // This will drop the video.stop events from the next log
      log = [];
      startTime = Date.now();

      // Track interview start again
      track('sessionStarted');
      trackSelfShowQuestion();

      // Restart recordings
      restartRecordings();
    });
  }

  function setLanguage(language, user) {
    // Update dropdown
    $('#cc-Language').val(language);

    // Switch editor the laguage
    editor.setOption('mode', language);

    // Store language on the question
    currentQuestion.language = language;

    track('editor.languageChange', {
      user: user,
      language: language
    });

    storeKeyframe();
  }

  function doUpload(tracks) {
    // Create an instance for our blobs
    var data = new FormData();

    // Add each track to the data instance
    var extension;
    for (var i = 0; i < tracks.length; i++) {
      var track = tracks[i];
      if (track.type === 'audio') {
        extension = 'wav';
      }
      else if (track.type === 'video') {
        extension = 'webm';
      }
      else if (track.type === 'json') {
        extension = 'json';
      }

      data.append(track.name, track.blob, track.name+'.'+extension);
    }

    $.ajax('/storeSession/'+encodeURIComponent(room), {
      data: data,
      cache: false,
      contentType: false,
      processData: false,
      type: 'POST'
    })
    .then(
      function(response) {
        new Growl('Upload successful.');
        console.log('Upload successful: ', response.message);
      },
      function(jqXHR) {
        var response = getResponseFromXHR(jqXHR);

        console.error('Upload failed: ', response.message);
        new Growl('Upload failed: '+response.message, { time: 0 });
      }
    );
  }

  function setRunButtonStatus() {
    if (!currentQuestion.code) {
      els.runCodeButton.disabled = true;
    }
    else {
      els.runCodeButton.disabled = false;
    }
  }

  function setPrevNextStatus() {
    $('.js-previousQuestion').attr('disabled', currentQuestionIndex === 0);
    $('.js-nextQuestion').attr('disabled', currentQuestionIndex === questions.length - 1);
  }

  function setTitle(name, subTitle) {
    $('#cc-RoomName').text(name);

    if (subTitle) {
      $('#cc-SubTitle').show().text(subTitle);
    }
    else {
      $('#cc-SubTitle').hide();
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

  function broadcastName(peer) {
    (peer ? peer.sendDirectly : webrtc.sendDirectlyToAll).call(peer || webrtc, 'simplewebrtc', 'hello', { user: ourUser });
  }

  function broadcastQuestions(peer) {
    (peer ? peer.sendDirectly : webrtc.sendDirectlyToAll).call(peer || webrtc, 'simplewebrtc', 'changeQuestion', { questions: questions, questionIndex: currentQuestionIndex });
  }

  function resetOutput() {
    console.output = '';
  }

  function runCode() {
    var func;
    var results = [];
    var testOutput = '';

    resetOutput();

    // Build function body
    var functionBody = editor.getValue();
    if (currentQuestion.test) {
      functionBody += ';('+currentQuestion.test.toString()+'());';
    }

    // Parse code
    try {
      func = new Function(functionBody);
    }
    catch(error) {
      results.push({
        message: 'Code doesn\'t parse: '+error,
        error: error
      });
    }

    if (func) {
      // Shim log/assert
      var assert = console.assert;
      var log = console.log;
      console.log = function(string) {
        console.output = typeof console.output === 'string' ? console.output : '';
        console.output += string;
        testOutput += string;
      };

      console.assert = function(test, message, reason) {
        if (!test) {
          results.push({
            value: test,
            message: 'Test failed: '+message,
            reason: reason,
            output: testOutput,
            error: true
          });
        }
        else {
          results.push({
            value: test,
            output: testOutput,
            message: 'Test passed: '+message
          });
        }
        testOutput = '';
      };

      try {
        // Run the input and tests
        func.call(null);
      }
      catch(error) {
        results.push({
          message: 'Code errors: '+error,
          error: error
        });
      }

      // Remove shims
      console.assert = assert;
      console.log = log;
    }

    track('codeExecuted', {
      question: currentQuestion,
      questionIndex: currentQuestionIndex,
      output: console.output,
      results: results,
      user: ourUser
    });

    var resultMessage = 'Test results: \n';
    results.forEach(function(result) {
      var win = result.error ? 'X' : '✓';
      resultMessage += '  ['+win+'] '+result.message+'\n';
    });

    alert(resultMessage);
  }

  function getTime() {
    return Date.now() - startTime;
  }

  function track(eventName, data) {
    var obj = {
      time: getTime(),
      event: eventName
    };

    // Log events as originating from self by default
    if (typeof data !== 'undefined') {
      var user = data.user;
      data.user = undefined;

      // Copy peer property from data object
      obj.data = JSON.parse(JSON.stringify(data)); // @todo keep as JSON for @perf?
      obj.user = user;
    }
    else {
      obj.user = ourUser;
    }

    log.push(obj);

    // console.log('%s: %s', eventName, JSON.stringify(obj));
  }

  function trackSelfShowQuestion() {
    track('showQuestion', {
      user: ourUser,
      question: currentQuestion,
      questionIndex: currentQuestionIndex
    });
  }

  function storeKeyframe() {
    keyframeChangedSinceLastReport = true;
    currentKeyframe = {
      question: currentQuestion,
      questionIndex: currentQuestionIndex
    };
  }

  function showQuestion(questionIndex, noTrigger) {
    els.$footerButtons[isInterviewer ? 'show' : 'hide']();

    if (questions[questionIndex]) {
      currentQuestionIndex = questionIndex;
      currentQuestion = questions[questionIndex];

      if (currentQuestion.code) {
        setTitle('Question '+(questionIndex+1), currentQuestion.name);
      }
      else {
        setTitle(currentQuestion.name);
      }

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

      setRunButtonStatus();
      setPrevNextStatus();

      if (!noTrigger) {
        broadcastQuestions();
      }

      storeKeyframe();
    }
  }

  function getResponseFromXHR(jqXHR) {
    var response = {};
    try {
      response = JSON.parse(jqXHR.responseText);
    }
    catch(error) {
      response.status = 'ERROR';
      response.body = null;
      response.message = 'The server returned an invalid response.';
    }
    return response;
  }
}

// Initialze when ready
$(init);
