var $ = require('jquery');
var CodeMirror = require('codemirror');

// Include modes
require('codemirror/mode/javascript/javascript');
require('codemirror/mode/htmlmixed/htmlmixed');
require('codemirror/mode/clike/clike');
require('codemirror/mode/ruby/ruby');
require('codemirror/mode/python/python');

var running = false;
var interview = null;
var eventIndex = 0;
var time = 0;
var videoCount = 0;
var marks = [];
var videoEls = [];
var audioEls = [];
var interviewName;
var els = {
  audioPanel: '#cc-AudioPanel',
  videoPanel: '#cc-VideoPanel',
  languageSelect: '#cc-Language',
  editor: '#cc-EditorComponent',
  runCodeButton: '.js-runCode',
  downloadButton: '#cc-DownloadButton',
  videoTime: '#cc-VideoTime',
  videoTimeDisplay: '#cc-VideoTimeDisplay'
};
var editor;

function init() {
  editor = CodeMirror.fromTextArea(document.getElementById('cc-Code'), {
    dragDrop: false, // Too hard to sync between clients
    mode: 'javascript',
    lineNumbers: true,
    indentUnit: 2,
    theme: 'ambiance',
    viewportMargin: Infinity
  });

  // Make element references
  for (var el in els) {
    els['$'+el] = $(els[el]);
    els[el] = els['$'+el][0];
  }

  $(els.videoTime).on('change', function() {
    console.log('Not implemented!');
    // var time = els.videoTime.value;
    // seekTo(time);
  });

  load(window.location.hash.slice(1));
}

var raf =
  window.requestAnimationFrame ||
  window.mozRequestAnimationFrame ||
  window.msRequestAnimationFrame ||
  window.oRequestAnimationFrame ||
  window.webkitRequestAnimationFrame;

function play() {
  running = true;
  raf(loop);
}

function pause() {
  // Pause all audio
  // Pause all video

  // Pause event playback
  running = false;
}

function load(interviewNameToLoad) {
  interviewName = interviewNameToLoad;

  // Load JSON
  var request = $.ajax('results/'+interviewName+'/interview.json');

  request.done(function(interviewData) {
    interview = interviewData;

    interview.name = interview.name || interviewName;

    interview.duration = interview.duration || interview.log[interview.log.length -1].time;

    els.videoTime.max = interview.duration;

    videoEls.length = 0;
    audioEls.length = 0;
    time = 0;
    videoCount = 0;
    marks.length = 0;
    eventIndex = 0;
    play();
  });

  request.fail(function(jqXHR, textStatus) {
    alert('Failed to load interview:'+textStatus);
  });
}

var hasSeeked = false;
function loop(time) {
  if (!running) {
    return;
  }

  // Update time bar
  els.videoTime.value = time;
  els.videoTimeDisplay.textContent = getPrettyTime(time);

  var nextEvent = interview.log[eventIndex];

  if (nextEvent) {
    if (time >= nextEvent.time) {
      handleEvent(nextEvent);
      eventIndex++;
    }

    // Seek to sync things up initially
    if (!hasSeeked) {
      hasSeeked = seekTo(time);
    }
  }
  else {
    pause();
  }

  raf(loop);
}

function zeroPad(num, spaces) {
  if (!spaces) {
    spaces = 2;
  }
  num = num + '';
  while (spaces && num.length < spaces) {
    num = '0'+num;
  }
  return num;
}

function getPrettyTime(milliseconds) {
  var x = milliseconds / 1000;
  var seconds = Math.round(x % 60);
  x /= 60;
  var minutes = Math.round(x % 60);
  x /= 60;
  var hours = Math.round(x);

  // Only show hours when non-zero
  var output = '';
  if (hours > 0) {
    output += zeroPad(hours) + ':';
  }

  output += zeroPad(minutes) + ':' + zeroPad(seconds);

  return output;
}

function setEventIndex(time) {
  // Find event matching time
  // Set as current event
  // Continue
  var nextEvent = interview.log[eventIndex];
  while (nextEvent && nextEvent.time < time) {

  }
}

function handleEvent(event) {
  var name = event.event;
  var data = event.data;
  var user = event.user;

  console.log(event);

  if (name === 'showQuestion') {
    handleShowQuestion(data.questionIndex, data.question);
  }
  else if (name === 'editor.selection') {
    handleEditorSelections(data.selections);
  }
  else if (name === 'editor.changed') {
    handleEditorChange(data.change);
  }
  else if (name === 'editor.refreshed') {
    handleEditorRefresh(data.body);
  }
  else if (name === 'editor.languageChange') {
    handleLanguageChange(data.language);
  }
  else if (name === 'video.started') {
    handleVideoStarted(user);
  }
  else if (name === 'audio.started') {
    handleAudioStarted(user);
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

function handleVideoStarted(user) {
  // Update video count
  setVideoCount(+1);

  // Add video element
  if (els.videoPanel) {
    // Create video tag
    var video = document.createElement('video');

    // @todo use unique interview.name
    video.src = 'results/'+interviewName+'/'+user+'.video.webm';
    video.autoplay = true;

    var d = document.createElement('div');
    d.className = 'cc-Video cc-Video--canEnlarge';
    d.id = 'container_' + user;
    d.appendChild(video);

    // @todo track hark events
    /*
    var vol = document.createElement('div');
    vol.id = 'volume_' + user;
    vol.className = 'cc-Video-speaking cc-Icon icon-speaker-active';
    d.appendChild(vol);
    */

    // Click to enlarge video
    var fullSize = false;
    video.onclick = function() {
      d.classList[fullSize ? 'remove' : 'add']('cc-Video--fullSize');
      fullSize = !fullSize;
    };

    els.videoPanel.appendChild(d);

    videoEls.push(video);
  }
}

function handleAudioStarted(user) {
  var audio = document.createElement('audio');
  audio.src = 'results/'+interviewName+'/'+user+'.audio.wav';
  audio.autoplay = true;
  els.audioPanel.appendChild(audio);

  audioEls.push(audio);
}

function handleEditorRefresh(data) {
  editor.setValue(data);
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

function showVideo() {
  els.$videoPanel.show();
}

function hideVideo() {
  els.$videoPanel.hide();
}

function showCode(code) {
  els.$editor.show();
  els.$languageSelect.show();

  if (code) {
    editor.setValue(code);
  }
}

function hideCode() {
  els.$languageSelect.hide();
  els.$editor.hide();
}

function handleShowQuestion(questionIndex, currentQuestion) {
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
}

function handleEditorSelections(selections) {
  // Clear previous marks
  while (marks.length) {
    marks.pop().clear();
  }

  // Highlight each selection
  for (var i = 0; i < selections.length; i++) {
    var selection = selections[i];
    if (selection.head.line === selection.anchor.line && selection.head.ch === selection.anchor.ch) {
      // Cursor
      var el = document.createElement('span');
      el.className = 'cc-Cursor';
      marks.push(editor.doc.setBookmark(selection.head, { widget: el }));
    }
    else {
      // Selection

      // Correct order
      var start = selection.head;
      var end = selection.anchor;
      if (selection.head.line > selection.anchor.line || (selection.head.line === selection.anchor.line && selection.head.ch > selection.anchor.ch)) {
        start = selection.anchor;
        end = selection.head;
      }

      marks.push(editor.doc.markText(start, end, { className: 'cc-Highlight' }));
    }
  }
}

function handleEditorChange(change) {
  editor.replaceRange(change.text, change.from, change.to);
}

function handleLanguageChange(language) {
  // Switch editor the laguage
  editor.setOption('mode', language);

  // Update dropdown
  $('#cc-Language').val(language);
}

function seekTo(time) {
  var success = true;
  for (var i = 0; i < audioEls.length; i++) {
    var el = audioEls[i];

    if (el.readyState !== 0) {
      el.currentTime = time/1000;
    }
    else {
      success = false;
    }
  }
  for (var i = 0; i < videoEls.length; i++) {
    var el = videoEls[i];

    if (el.readyState !== 0) {
      el.currentTime = time/1000;
    }
    else {
      success = false;
    }
  }
  return success;
}

$(init);
