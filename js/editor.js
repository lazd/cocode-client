var $ = require('jquery');
var CodeMirror = require('codemirror');

// Include modes
require('codemirror/mode/javascript/javascript');
require('codemirror/mode/htmlmixed/htmlmixed');
require('codemirror/mode/clike/clike');
require('codemirror/mode/ruby/ruby');
require('codemirror/mode/python/python');

// Include CodeMirror theme
// require('code-mirror/theme/ambiance');

module.exports = function(webrtc) {
  var editor = CodeMirror.fromTextArea(document.getElementById('cc-Code'), {
    dragDrop: false, // Too hard to handle in code
    mode: 'javascript',
    lineNumbers: true,
    theme: 'ambiance'
  });

  // Handle language changes
  $('#cc-Language').on('change', function(event) {
    var language = event.currentTarget.value;

    editor.setOption('mode', language);

    webrtc.sendDirectlyToAll('editor', 'changeLanguage', language);
  });

  webrtc.on('peerStreamAdded', function(peer) {
    // Works, but connections drop when connecting clients at precisely the same time
    broadcastEditorContents();

    // Causes the random connection drop bug
    // webrtc.sendDirectlyToAll('editor', 'open', 'sesame');
    // webrtc.sendDirectlyToAll('editor', 'sesame', 'open');

    // Causes the random connection drop bug
    // webrtc.sendDirectlyToAll('editor', 'open', 'sesame');

    // Causes the random connection drop bug
    // Try to get that data channel open
    // Don't call methods on the peer object, it causes bugs!
    // webrtc.sendDirectlyToAll('editor', 'hello');

    // Causes the random connection drop bug
    // Open the editor channel with the peer
    // peer.getDataChannel('editor');
  });

  function broadcastEditorContents() {
    var editorContents = editor.getValue();
    var language = $('#cc-Language').val();

    if (editorContents) {
      console.log('Sending editor contents to peers!');

      // When the channel is open, send the current contents of the editor to everyone
      webrtc.sendDirectlyToAll('editor', 'refresh', editorContents);

      // Send the current language
      webrtc.sendDirectlyToAll('editor', 'changeLanguage', language);
    }
  }

  webrtc.on('channelOpen', function(channel) {
    console.log('%s opened!', channel.label);

    if (channel.label === 'editor') {
      // When the editor channel opens, broadcast the goodies
      // This is a bit redundant because we tried to do that when peerStreamAdded
      // But it turns out all good
      broadcastEditorContents();
    }
  });

  webrtc.on('channelClose', function(channel) {
    console.warn('%s closed!', channel.label);
  });

  webrtc.on('channelError', function(label, error) {
    console.error('Error on %s: %s', label, error);
  });

  webrtc.on('channelMessage', function (peer, label, data) {
    if (label === 'editor') {
      var payload = data.payload;
      if (data.type === 'refresh') {
        console.log('Refreshing editor contents');
        editor.setValue(payload);
      }
      else if (data.type === 'change') {
        editor.replaceRange(payload.text, payload.from, payload.to);
      }
      else if (data.type === 'changeLanguage') {
        $('#cc-Language').val(payload);
        editor.setOption('mode', payload);
      }
      else if (data.type === 'selection') {
        highlightSelections(payload);
      }
    }
  });

  editor.on('change', function(i, op) {
    /*
      Bug:
        Select all, paste. Had an extra pasted item on the remote
        Undo/Redo
        Contents get out of sync sometimes... Need a mechanism to resync...
    */
    if (op.origin == '+input' || op.origin == '+delete' || op.origin == 'cut' || op.origin == 'paste') {
      webrtc.sendDirectlyToAll('editor', 'change', op);
    }
    // socket.emit('refresh', editor.getValue());
  });

  editor.on('cursorActivity', function() {
    var selections = editor.doc.listSelections();

    webrtc.sendDirectlyToAll('editor', 'selection', selections);
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
