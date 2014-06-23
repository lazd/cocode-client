var $ = require('jquery');
var SimpleWebRTC = require('./SimpleWebRTC');
var Editor = require('./editor');
var questions = require('./questions');

function init() {
  // Current number of videos displayed, including our own
  var videoCount = 1;

  // A log of evenst
  var log = [];

  var currentQuestion = null;
  var currentQuestionIndex = 0;

  // Grab the room from the URL
  var room = location.hash.slice(1);

  var els = {
    videoPanel: '#cc-VideoPanel',
    local: '#cc-LocalVideo',
    languageSelect: '#cc-Language',
    editor: '#cc-EditorComponent',
    runCodeButton: '.js-runCode',
    downloadButton: '#cc-DownloadButton'
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
  var editor = Editor(webrtc, track);

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
        broadcastQuestions();
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

    track('collaborator.joined', { name: peer.id });

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

    track('collaborator.left', { name: peer.id });

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
        // Use questions from peer
        questions = data.payload.questions;

        // Show same question as peer
        showQuestion(data.payload.questionIndex, true);

        track('showQuestion', {
          peer: peer.id,
          question: data.payload.questionIndex
        });
      }
    }
  });

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
      question: currentQuestionIndex,
      code: currentQuestion.code
    };

    track('bookmark', data);
  });

  $(document.body).on('click', '.js-downloadSession', function(event) {
    downloadSession(event);
  });

  $(document.body).on('click', '.js-runCode', function(event) {
    runCode();
  });

  // Save code changes to the question so it shows when revisited
  editor.on('change', function(i, op) {
    currentQuestion.code = editor.getValue();
    setRunButtonStatus();
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

  // @todo change to setTitle, separate room creation into a different method
  function setRoom(name, subTitle) {
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

  function broadcastQuestions() {
    webrtc.sendDirectlyToAll('simplewebrtc', 'changeQuestion', { questions: questions, questionIndex: currentQuestionIndex });
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
      peer: 'self',
      question: currentQuestionIndex,
      output: console.output,
      results: results
    });

    var resultMessage = 'Test results: \n';
    results.forEach(function(result) {
      var win = result.error ? 'X' : '✓';
      resultMessage += '  ['+win+'] '+result.message+'\n';
    });

    alert(resultMessage);
  }

  function track(event, data) {
    var obj = {
      date: new Date().toISOString(),
      event: event
    };

    var peer;
    if (typeof data !== 'undefined') {
      // Copy peer property from data object
      peer = data.peer;
      data.peer = undefined;

      obj.data = JSON.parse(JSON.stringify(data)); // @todo keep as JSON for @perf?
    }

    // Log events as originating from self by default
    obj.peer = peer || 'self';

    log.push(obj);

    // console.log('%s: %s', event, JSON.stringify(obj));
  }

  function trackSelfShowQuestion() {
    track('showQuestion', {
      peer: 'self',
      question: currentQuestionIndex
    });
  }

  function downloadSession(event) {
    var session = {
      log: log,
      questions: questions
    };

    var data = 'text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(session));

    // Check for anchor with download ability
    var downloadAttrSupported = ('download' in document.createElement('a'));

    if (downloadAttrSupported) {
      // Create an anchor to download it, click it
      // This only works in Chrome and FF 20+
      els.downloadButton.setAttribute('href', 'data:'+data);
      els.downloadButton.setAttribute('download', room+'.json');
    }
    else {
      // Open the image in a popup
      window.open(url, data);
      if (event) {
        event.preventDefault();
      }
    }
  }

  function showQuestion(questionIndex, noTrigger) {
    if (questions[questionIndex]) {
      currentQuestionIndex = questionIndex;
      currentQuestion = questions[questionIndex];

      if (currentQuestion.code) {
        setRoom('Question '+(questionIndex+1), currentQuestion.name);
      }
      else {
        setRoom(currentQuestion.name);
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
    }
  }
}

// Initialze when ready
$(init);
