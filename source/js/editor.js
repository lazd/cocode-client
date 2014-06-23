var $ = require('jquery');
var CodeMirror = require('codemirror');

// Include modes
require('codemirror/mode/javascript/javascript');
require('codemirror/mode/htmlmixed/htmlmixed');
require('codemirror/mode/clike/clike');
require('codemirror/mode/ruby/ruby');
require('codemirror/mode/python/python');

module.exports = function(simplewebrtc, track) {
  // Get the webrtc instance from the SimpleWebRTC instance
  var webrtc = simplewebrtc.webrtc;

  var editor = CodeMirror.fromTextArea(document.getElementById('cc-Code'), {
    dragDrop: false, // Too hard to sync between clients
    mode: 'javascript',
    lineNumbers: true,
    theme: 'ambiance',
    viewportMargin: Infinity
  });

  // Handle language changes
  $('#cc-Language').on('change', function(event) {
    var language = event.currentTarget.value;

    editor.setOption('mode', language);

    webrtc.sendDirectlyToAll('simplewebrtc', 'changeLanguage', language);
  });

  function broadcastEditorContents() {
    var editorContents = editor.getValue();
    var language = $('#cc-Language').val();

    if (editorContents) {
      console.log('Sending editor contents to peers!');

      // When the channel is open, send the current contents of the editor to everyone
      webrtc.sendDirectlyToAll('simplewebrtc', 'refresh', editorContents);

      // Send the current language
      webrtc.sendDirectlyToAll('simplewebrtc', 'changeLanguage', language);
    }
  }

  webrtc.on('channelOpen', function(channel) {
    if (channel.label === 'simplewebrtc') {
      // When the editor channel opens, broadcast the goodies
      // This is a bit redundant because we tried to do that when peerStreamAdded
      // But it turns out all good
      broadcastEditorContents();
    }
  });

  webrtc.on('channelMessage', function (peer, label, data) {
    if (label === 'simplewebrtc') {
      var payload = data.payload;
      if (data.type === 'refresh') {
        console.log('Refreshing editor contents');
        editor.setValue(payload);

        track('editor.refreshed', {
          peer: peer.id,
          payload: payload
        });
      }
      else if (data.type === 'change') {
        editor.replaceRange(payload.text, payload.from, payload.to);

        track('editor.changed', {
          peer: peer.id,
          change: payload
        });
      }
      else if (data.type === 'changeLanguage') {
        $('#cc-Language').val(payload);
        editor.setOption('mode', payload);

        track('editor.languageChange', {
          peer: peer.id,
          language: payload
        });
      }
      else if (data.type === 'selection') {
        highlightSelections(payload);

        track('editor.selection', {
          peer: peer.id,
          payload: payload
        });
      }
    }
  });

  var editorOperations = [
    '+input',
    '+delete',
    'cut',
    'paste',
    'undo',
    'redo'
  ];

  editor.on('change', function(i, op) {
    if (editorOperations.indexOf(op.origin) !== -1) {
      webrtc.sendDirectlyToAll('simplewebrtc', 'change', op);

      track('editor.changed', {
        peer: 'self',
        change: op
      });
    }
  });

  editor.on('cursorActivity', function() {
    var selections = editor.doc.listSelections();

    webrtc.sendDirectlyToAll('simplewebrtc', 'selection', selections);

    track('editor.selection', {
      peer: 'self',
      payload: selections
    });
  });

  var marks = [];
  function highlightSelections(selections) {
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

  return editor;
};
