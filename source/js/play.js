var $ = require('jquery');
var CodeMirror = require('codemirror');
var raf = require('./raf.js');
var Growl = require('./growl');

// Include modes
require('codemirror/mode/javascript/javascript');
require('codemirror/mode/htmlmixed/htmlmixed');
require('codemirror/mode/clike/clike');
require('codemirror/mode/ruby/ruby');
require('codemirror/mode/python/python');

// Media states
const HAVE_NOTHING = 0;
const HAVE_METADATA = 1;
const HAVE_CURRENT_DATA = 2;
const HAVE_FUTURE_DATA = 3;
const HAVE_ENOUGH_DATA = 4;

var session = null;
var part = null;
var paused = true;
var interview = null;
var eventIndex = 0;
var time = 0;
var videoCount = 0;
var marks = [];
var videoEls = [];
var audioEls = [];

// A set of preloaded audio/video elements corresponding to the event index
var preloadedTracks = {};

// ms the loop has been running
var loopTime = 0;

// The ms in loop time of the last reset
var currentTime = 0;

// The set of bookmarks
var bookmarks = [];

var interviewName;
var els = {
  audioPanel: '#cc-AudioPanel',
  videoPanel: '#cc-VideoPanel',
  languageSelect: '#cc-Language',
  editor: '#cc-EditorComponent',
  runCodeButton: '.js-runCode',
  downloadButton: '#cc-DownloadButton',
  videoTime: '#cc-VideoTime',
  videoTimeDisplay: '#cc-VideoTimeDisplay',
  videoTotalTimeDisplay: '#cc-VideoTotalTimeDisplay',
  prevBookmarkButton: '.js-prevBookmark',
  nextBookmarkButton: '.js-nextBookmark',
  markerContainer: '#cc-BookmarkMarkerContainer',
  playPauseButton: '.js-playPause',
  playPauseButtonIcon: '.js-playPause > i',
  prevPartButton: '.js-prevPart',
  nextPartButton: '.js-nextPart'
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

  // Listen to seek events
  $(els.videoTime).on('change', function() {
    // So it updates
    els.videoTime.blur();

    var time = els.videoTime.value;
    seekTo(time);
  });

  $(document).on('click', '.js-prevBookmark', seekToPrevBookmark);
  $(document).on('click', '.js-nextBookmark', seekToNextBookmark);
  $(document).on('click', '.js-playPause', playPause);

  // No part by default
  part = '';

  var resourceDescription;

  // Get session/part from hash
  var search = window.location.search;
  var hash = window.location.hash;
  if (search) {
    resourceDescription = search.slice(1);
  }
  else if (hash) {
    resourceDescription = hash.slice(1);
  }
  else {
    alert('No interview specified.');
    return;
  }

  var descriptionParts = resourceDescription.split('.');
  var partNumber = -1;
  session = descriptionParts[0];
  if (descriptionParts.length > 1) {
    part = '.'+descriptionParts[1];
    partNumber = parseInt(descriptionParts[1]);
  }
  else {
    part = '.'+1;
    partNumber = 1;
    window.history.replaceState({}, null, '?'+session+part);
  }

  // Load the interview specified in the hash
  // @todo make time linkable when seek works
  load(session);

  raf(loop);

  if (partNumber) {
    var nextPartNumber = partNumber + 1;
    var prevPartNumber = partNumber - 1;
    // See if there is a next part
    var request = $.ajax('results/'+interviewName+'/interview.'+nextPartNumber+'.json');
    request.done(function(interviewData) {
      // Show next button
      console.log('There are more parts');
      els.$nextPartButton.attr('href', '?'+session+'.'+nextPartNumber).show();
    });
    request.fail(function(jqXHR, textStatus) {
      // Hide next button
      console.log('There is no next part');
      els.$nextPartButton.hide();
    });

    // See if there is a previous part
    if (partNumber > 1) {
      var request = $.ajax('results/'+interviewName+'/interview.'+prevPartNumber+'.json');
      request.done(function(interviewData) {
        // Show prev button
        console.log('There are previous parts');
        els.$prevPartButton.attr('href', '?'+session+'.'+prevPartNumber).show();
      });
      request.fail(function(jqXHR, textStatus) {
        // Hide prev button
        console.log('There are no previous parts');
        els.$prevPartButton.hide();
      });
    }
    else {
      // We're on first part, so hide the previous button
      els.$prevPartButton.hide();
    }
  }
}

function play() {
  paused = false;

  // Play all audio and video
  setMediaPauseState();

  els.playPauseButtonIcon.className = 'icon-pause';
  els.playPauseButton.disabled = false;
}

function pause() {
  // Pause all audio and video
  eachMedia(function(el) {
    el.pause();
  });

  // Pause event playback
  paused = true;

  els.playPauseButtonIcon.className = 'icon-play';
}

function playPause() {
  if (paused) {
    play()
  }
  else {
    pause();
  }
}

function load(interviewNameToLoad) {
  interviewName = interviewNameToLoad;

  // Load JSON
  var request = $.ajax('results/'+interviewName+'/interview'+part+'.json');

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

    // Set total time display
    els.videoTotalTimeDisplay.textContent = getPrettyTime(interview.duration);

    // Store the set of bookmarks
    bookmarks = interview.log.filter(function(event, index) {
      // While we're looping over everyone, set the index on the object
      event.index = index;

      // Return only bookmarks
      if (event.event === 'bookmark') {
        // Add a marker
        var marker = document.createElement('div');
        marker.className = 'cc-TimelineContainer-marker icon-bookmark';
        marker.style.left = (event.time/interview.duration * 100) + '%';
        els.markerContainer.appendChild(marker);

        return true;
      }
    });

    if (bookmarks.length) {
      els.$prevBookmarkButton.show();
      els.$nextBookmarkButton.show();
    }
    else {
      // Don't show buttons if there are no bookmarks
      els.$prevBookmarkButton.hide();
      els.$nextBookmarkButton.hide();
    }

    preloadTracks(play);
  });

  request.fail(function(jqXHR, textStatus) {
    alert('Failed to load interview:'+textStatus);
  });
}

function setBookmarkNavState() {
  // Check if there is a bookmark before the current time and after the current time
  var bookmarkBefore = false;
  var bookmarkAfter = false;
  bookmarks.forEach(function(bookmark) {
    if (bookmark.time < currentTime) {
      bookmarkBefore = true;
    }
    else if (bookmark.time > currentTime) {
      bookmarkAfter = true;
    }
  });

  els.prevBookmarkButton.disabled = !bookmarkBefore;
  els.nextBookmarkButton.disabled = !bookmarkAfter;
}

function preloadVideo(url, index) {
  // Create video tag
  var video = document.createElement('video');

  // @todo use unique interview.name
  video.src = url;
  video.autoplay = false;
  video.preload = 'auto';

  var d = document.createElement('div');
  d.className = 'cc-Video cc-Video--canEnlarge';
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

  // Hide until played
  video.style.display = 'none';

  preloadedTracks[index] = video;
  videoEls.push(video);

  return video;
}

function preloadAudio(url, index) {
  var audio = document.createElement('audio');
  audio.src = url;
  audio.preload = 'auto';
  audio.autoplay = false;
  els.audioPanel.appendChild(audio);

  preloadedTracks[index] = audio;
  audioEls.push(audio);

  return audio;
}

function preloadTracks(cb) {
  var toLoad = 0;
  var totalTracks = 0;
  function handleCanPlay() {
    toLoad--;
    if (toLoad === 0 && typeof cb === 'function') {
      console.log('Preload complete!');
      cb();
    }
  }
  for (var i = 0; i < interview.log.length; i++) {
    var event = interview.log[i];
    var eventName = event.event;
    var time = event.time;
    var user = event.user;
    var track = null;
    if (eventName === 'video.started') {
      track = preloadVideo('results/'+interviewName+'/'+user+part+'.webm', i);
    }
    else if (eventName === 'audio.started') {
      track = preloadAudio('results/'+interviewName+'/'+user+part+'.wav', i);
    }

    if (track) {
      track._startTime = time;
      track.addEventListener('canplay', handleCanPlay);
      toLoad++;
      totalTracks++;
    }
  }

  if (!totalTracks) {
    cb();
  }
}

var last = 0;
function loop(time) {
  var delta = time - last;
  last = time;

  if (!paused) {
    // Calculate time
    currentTime += delta;

    // Update time bar
    if (!els.$videoTime.is(':focus')) {
      els.videoTime.value = currentTime;
    }

    els.videoTimeDisplay.textContent = getPrettyTime(currentTime);

    var nextEvent = interview.log[eventIndex];

    if (nextEvent) {
      // Only bother setting the state of the bookmark buttons if there is another event
      setBookmarkNavState();

      if (currentTime >= nextEvent.time) {
        handleEvent(nextEvent, eventIndex);
        eventIndex++;
      }
    }

    if (currentTime > interview.duration) {
      // Pause the interview when it's over
      pause();

      // Don't let them play again until seeking
      els.playPauseButton.disabled = true;
    }
  }

  raf(loop);
}

function seekToPrevBookmark() {
  var prevBookmark = null;
  bookmarks.some(function(bookmark) {
    // Give a second buffer so it's possible to go back
    if (bookmark.time < currentTime - 1000) {
      prevBookmark = bookmark;
    }
    else if (bookmark.time > currentTime) {
      return true;
    }
  });

  if (prevBookmark) {
    seekTo(prevBookmark.time);
  }
}

function seekToNextBookmark() {
  var nextBookmark = null;
  bookmarks.some(function(bookmark) {
    if (bookmark.time > currentTime) {
      nextBookmark = bookmark;
      return true;
    }
  });

  if (nextBookmark) {
    seekTo(nextBookmark.time);
  }
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
  var event = null;
  var i = 0;

  // Clear editor
  editor.setValue('');

  // Find the last keyframe
  var lastKeyFrame = interview.log[0];
  var lastKeyFrameIndex = 0;
  for (var i = 0; i < interview.log.length; i++) {
    var event = interview.log[i];

    // We found the last event, stop
    if (event.time > time) {
      break;
    }

    // This keyframe happened before the desired time
    if (event.event === 'keyframe') {
      lastKeyFrame = event;
      lastKeyFrameIndex = i;
    }
  }

  // Start replying events after this keyframe
  eventIndex = lastKeyFrameIndex;

  // Don't set the time to keyframe time; there are no events to worry about between then and now
  // currentTime = lastKeyFrame.time;
}

function handleEvent(event, index) {
  var name = event.event;
  var data = event.data;
  var user = event.user;

  // console.log(event);

  if (name === 'showQuestion') {
    handleShowQuestion(data.questionIndex, data.question);
  }
  else if (name === 'keyframe') {
    handleShowQuestion(data.questionIndex, data.question);
    // @todo show/hide video here?
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
    handleLanguageChange(data.language, user);
  }
  else if (name === 'video.started') {
    handleVideoStarted(index);
  }
  else if (name === 'audio.started') {
    handleAudioStarted(index);
  }
  else if (name === 'video.ended') {
    // @todo #27 hide video
    // setVideoCount();
  }
  else if (name === 'collaborator.joined') {
    handleUserJoined(user);
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

function setVideoCount(count) {
  if (count === undefined) {
    count = 0;
    videoEls.forEach(function(el) {
      if (el.style.display !== 'none') {
        count++;
      }
    });
  }

  videoCount = count;

  els.videoPanel.className = els.videoPanel.className.replace(/cc-VideoPanel--\d+/g, '');
  els.videoPanel.classList.add('cc-VideoPanel--'+videoCount);
}

function handleUserJoined(user) {
  new Growl(user+' has joined.');
}

function handleVideoStarted(index) {
  var video = preloadedTracks[index];
  video.style.display = '';
  video.play();

  // Update video count
  setVideoCount();
}

function handleAudioStarted(index) {
  preloadedTracks[index].play();
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

function handleLanguageChange(language, user) {
  // Switch editor the laguage
  editor.setOption('mode', language);

  // Update dropdown
  $('#cc-Language').val(language);

  // Get the label value from the dropdown
  // @todo use an object map instead
  var languageLabel = $('#cc-Language option:selected').text();

  new Growl(user+' changed the language to '+languageLabel);
}

function eachMedia(cb) {
  var success = true;
  for (var i = 0; i < audioEls.length; i++) {
    if (!cb(audioEls[i])) {
      success = false;
    }
  }
  for (var i = 0; i < videoEls.length; i++) {
    if (!cb(videoEls[i])) {
      success = false;
    }
  }
  return success;
}

function setMediaPauseState() {
  // Seek or hide media
  var newVideoCount = 0;
  eachMedia(function(el) {
    // If the video should be playing
    var newTime = (currentTime - el._startTime)/1000;
    if (newTime > 0) {
      // Set its current time
      // console.log('Setting media time to ', newTime);
      el.play();
      el.currentTime = newTime;
      el.style.display = '';
      if (el.tagName === 'VIDEO') {
        newVideoCount++;
      }
    }
    else if (el.readyState !== HAVE_NOTHING) {
      // console.log('Stopping media ', newTime);
      el.currentTime = 0;
      el.pause();
      el.style.display = 'none';
    }
  });

  // Set the video count for nice presentation
  setVideoCount(newVideoCount);
}

function seekTo(time) {
  time = parseInt(time);
  currentTime = time;

  // Replay all events
  setEventIndex(time);

  // Unpause
  play();
}

$(init);
